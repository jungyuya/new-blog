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

  for (const record of event.Records) {
    try {
      const eventName = record.eventName;

      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = record.dynamodb?.NewImage;
        if (!newImage) continue;
        const postData = unmarshall(newImage as any);

        // [신규] 공개글이 아니면 인덱싱하지 않고 건너뜀 (또는 기존 인덱스에서 삭제)
        if (postData.visibility !== 'public') {
          console.log(`Skipping private/draft post: ${postData.postId}`);
          // 만약 기존에 공개글이었다가 비밀글로 바뀐 경우를 대비해 삭제 로직을 수행하는 것이 안전.
          await opensearchClient.deleteByQuery({
            index: INDEX_NAME,
            body: { query: { term: { parentPostId: postData.postId } } }
          });
          continue;
        }

        if (postData.isDeleted === true) {
          // Soft Delete 처리: 해당 postId를 가진 모든 청크 삭제
          console.log(`Detected soft delete for postId: ${postData.postId}. Deleting all chunks.`);
          // OpenSearch의 delete_by_query를 사용하여 parentPostId가 일치하는 모든 문서 삭제
          await opensearchClient.deleteByQuery({
            index: INDEX_NAME,
            body: {
              query: {
                term: { parentPostId: postData.postId }
              }
            }
          });
        } else {
          // 1. 기존 청크 삭제 
          await opensearchClient.deleteByQuery({
            index: INDEX_NAME,
            body: {
              query: {
                term: { parentPostId: postData.postId }
              }
            }
          });

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

        await opensearchClient.deleteByQuery({
          index: INDEX_NAME,
          body: {
            query: {
              term: { parentPostId: deletedData.postId }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error processing a single record:', JSON.stringify(record, null, 2), error);
      // 개별 레코드 실패 시 전체 배치를 중단하지 않고 로그만 남김 (DLQ 처리는 Lambda 실패 시 수행됨)
      throw error;
    }
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