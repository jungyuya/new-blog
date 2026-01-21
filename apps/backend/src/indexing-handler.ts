// 파일 위치: apps/backend/src/indexing-handler.ts

import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'ap-northeast-2';

// OpenSearch 클라이언트 초기화
const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: REGION,
    service: 'es',
  }),
  node: process.env.OPENSEARCH_ENDPOINT!,
});

// Bedrock 클라이언트 초기화
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

const INDEX_NAME = 'posts';

// --- 재시도 유틸리티 함수 (Retry Logic) ---
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying in ${delayMs * attempt}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError!;
}

// --- [신규] 텍스트 청킹 함수 (Chunking Strategy) ---
// 마크다운 헤더(#)를 기준으로 나누고, 너무 길면 강제로 자릅니다.
function splitIntoChunks(text: string): string[] {
  if (!text) return [];

  const chunks: string[] = [];
  // 1. 헤더(#)를 기준으로 1차 분할
  const sections = text.split(/(?=^#{1,3}\s)/gm);

  for (const section of sections) {
    if (section.trim().length === 0) continue;

    // 2. 섹션이 너무 길면(예: 1000자 이상) 문단 단위로 다시 분할
    if (section.length > 1000) {
      const paragraphs = section.split(/\n\n+/);
      let currentChunk = "";

      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > 1000) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());
    } else {
      chunks.push(section.trim());
    }
  }

  return chunks;
}

// --- 텍스트 임베딩 함수 (Embedding) ---
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
        // Titan v2 옵션: 차원 수 (기본값 1024 사용)
        // dimensions: 1024, 
        // normalize: true
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding; // 1024차원 벡터 배열 반환
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// --- 벡터 데이터 삭제 함수 (Vector Deletion) ---
async function deleteVectorData(postId: string): Promise<void> {
  console.log(`Attempting to delete vector data for postId: ${postId}`);

  try {
    const deleteResponse = await retryOperation(async () => {
      return await opensearchClient.deleteByQuery({
        index: INDEX_NAME,
        body: {
          query: {
            term: { parentPostId: postId }
          }
        }
      });
    });

    // OpenSearch deleteByQuery 응답에서 삭제된 문서 수 추출
    const deletedCount = (deleteResponse.body as any).deleted || 0;
    console.log(`Successfully deleted ${deletedCount} chunks for postId: ${postId}`);

    if (deletedCount === 0) {
      console.warn(`No chunks found to delete for postId: ${postId}. This might be expected if the post was never indexed.`);
    }
  } catch (error) {
    console.error(`Failed to delete vector data for postId: ${postId} after retries`, error);
    throw error;
  }
}

// --- 인덱스 초기화 함수 (기존 코드 유지) ---
async function ensureIndexExists() {
  const exists = await opensearchClient.indices.exists({ index: INDEX_NAME });

  if (!exists.body) {
    console.log(`Index ${INDEX_NAME} does not exist. Creating...`);
    await opensearchClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          "index.knn": true,
          "analysis": {
            "analyzer": {
              "nori_analyzer": {
                "type": "custom",
                "tokenizer": "nori_tokenizer"
              }
            }
          }
        },
        mappings: {
          properties: {
            content_vector: {
              type: "knn_vector",
              dimension: 1024,
              method: {
                name: "hnsw",
                engine: "nmslib",
                space_type: "cosine"
              }
            },
            content: { type: "text", analyzer: "nori_analyzer" },
            title: { type: "text", analyzer: "nori_analyzer" },
            tags: { type: "keyword" },
            category: { type: "keyword" }, // [Epic 6] 카테고리 필드 추가
            status: { type: "keyword" },
            visibility: { type: "keyword" },
            postId: { type: "keyword" },
            chunkIndex: { type: "integer" },
            parentPostId: { type: "keyword" }
          }
        }
      }
    });
    console.log(`Index ${INDEX_NAME} created with vector mappings.`);
  }
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log(`Received ${event.Records.length} records from DynamoDB Stream.`);

  await ensureIndexExists();

  if (!event.Records || event.Records.length === 0) {
    return;
  }

  const bulkOperations: any[] = [];
  const failedRecords: { record: DynamoDBRecord; error: Error }[] = [];

  for (const record of event.Records) {
    try {
      const eventName = record.eventName;

      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = record.dynamodb?.NewImage;
        if (!newImage) continue;
        const postData = unmarshall(newImage as any);

        // [Epic 6] 인덱싱 조건 변경: Visibility 대신 ragIndex 확인
        // 레거시 호환성: ragIndex가 없으면 public일 때만 true
        const shouldIndex = postData.ragIndex ?? (postData.visibility === 'public');

        if (!shouldIndex) {
          console.log(`Skipping post (ragIndex=false): ${postData.postId}`);
          // 인덱싱 대상이 아니게 되었다면 벡터 삭제 (예: 학습 허용 껐을 때)
          await deleteVectorData(postData.postId);
          continue;
        }

        if (postData.isDeleted === true) {
          // Soft Delete 처리: 해당 postId를 가진 모든 청크 삭제
          console.log(`Detected soft delete for postId: ${postData.postId}. Deleting all chunks.`);
          await deleteVectorData(postData.postId);
        } else {
          // 1. 기존 청크 삭제 
          await deleteVectorData(postData.postId);

          // 2. 텍스트 청킹
          const chunks = splitIntoChunks(postData.content);
          console.log(`Split post ${postData.postId} into ${chunks.length} chunks.`);

          // 3. 각 청크 임베딩 및 문서 생성 (병렬 처리)
          const chunkDocs = await Promise.all(chunks.map(async (chunkText, index) => {
            const vector = await getEmbedding(chunkText);

            return {
              postId: `${postData.postId}_${index}`, // 청크별 고유 ID
              parentPostId: postData.postId,         // 원본 글 ID
              chunkIndex: index,
              title: postData.title,                 // 메타데이터 복사
              content: chunkText,                    // 청크 텍스트
              content_vector: vector,                // 벡터 데이터
              tags: postData.tags,
              category: postData.category || 'post', // [Epic 6] 카테고리 추가
              authorNickname: postData.authorNickname,
              createdAt: postData.createdAt,
              thumbnailUrl: postData.thumbnailUrl,
              status: postData.status,
              visibility: postData.visibility,
              isDeleted: false,
            };
          }));

          // 4. Bulk 연산 배열에 추가
          chunkDocs.forEach(doc => {
            bulkOperations.push({ index: { _index: INDEX_NAME, _id: doc.postId } });
            bulkOperations.push(doc);
          });
        }
      } else if (eventName === 'REMOVE') {
        const oldImage = record.dynamodb?.OldImage;
        if (!oldImage) continue;

        const deletedData = unmarshall(oldImage as any);
        console.log(`Detected hard delete for postId: ${deletedData.postId}. Deleting all chunks.`);

        await deleteVectorData(deletedData.postId);
      }
    } catch (error) {
      console.error('Error processing record:', JSON.stringify(record, null, 2), error);
      // 개별 레코드 실패를 기록하고 계속 진행
      failedRecords.push({ record, error: error as Error });
    }
  }

  // 실패한 레코드가 있으면 로그 출력
  if (failedRecords.length > 0) {
    console.error(`Failed to process ${failedRecords.length} out of ${event.Records.length} records`);
    failedRecords.forEach(({ record, error }, index) => {
      console.error(`Failed record ${index + 1}:`, {
        eventID: record.eventID,
        eventName: record.eventName,
        error: error.message
      });
    });
  }

  if (bulkOperations.length > 0) {
    console.log(`Sending ${bulkOperations.length / 2} documents to OpenSearch...`);
    try {
      const response = await opensearchClient.bulk({
        index: INDEX_NAME,
        body: bulkOperations,
      });

      if (response.body.errors) {
        const failedItems = response.body.items.filter((item: any) => item.index?.error || item.delete?.error);
        console.error('OpenSearch Bulk API returned errors:', JSON.stringify(failedItems, null, 2));
        throw new Error('Failed to process some documents in OpenSearch.');
      }
      console.log('Successfully processed bulk operations.');
    } catch (error) {
      console.error('Error sending bulk request to OpenSearch:', error);
      throw error;
    }
  }
};