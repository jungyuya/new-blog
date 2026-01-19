// 파일 위치: apps/backend/scripts/migrate-to-vector.ts

import { DynamoDBClient, ScanCommand, ScanCommandOutput } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config({ path: '.env' });

const REGION = process.env.AWS_REGION || 'ap-northeast-2';
const TABLE_NAME = process.env.TABLE_NAME || 'BlogPosts-BlogInfraStack';
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;

if (!OPENSEARCH_ENDPOINT) {
    console.error('OPENSEARCH_ENDPOINT is not defined in .env');
    process.exit(1);
}

// 클라이언트 초기화
const ddbClient = new DynamoDBClient({ region: REGION });
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const opensearchClient = new Client({
    ...AwsSigv4Signer({
        region: REGION,
        service: 'es',
    }),
    node: OPENSEARCH_ENDPOINT,
});

const INDEX_NAME = 'posts';

// --- 청킹 함수 ---
function splitIntoChunks(text: string): string[] {
    if (!text) return [];
    const chunks: string[] = [];
    const sections = text.split(/(?=^#{1,3}\s)/gm);
    for (const section of sections) {
        if (section.trim().length === 0) continue;
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

// --- 임베딩 함수 ---
async function getEmbedding(text: string): Promise<number[]> {
    const command = new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ inputText: text }),
    });
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
}

// --- 메인 마이그레이션 로직 ---
async function migrate() {
    console.log(`Starting migration for table: ${TABLE_NAME} -> index: ${INDEX_NAME}`);

    // 1. 기존 인덱스 삭제
    try {
        const exists = await opensearchClient.indices.exists({ index: INDEX_NAME });
        if (exists.body) {
            console.log('Deleting existing index...');
            await opensearchClient.indices.delete({ index: INDEX_NAME });
            // 인덱스 삭제 후 잠시 대기 (안정성 확보)
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } catch (e) {
        console.log('Error checking/deleting index:', e);
    }

    // 2. 인덱스 생성 (벡터 매핑 포함)
    // [핵심] 이 부분이 반드시 실행되어야 합니다!
    console.log('Creating new index with vector mappings...');
    await opensearchClient.indices.create({
        index: INDEX_NAME,
        body: {
            settings: {
                "index.knn": true,
                "analysis": {
                    "analyzer": {
                        "korean_analyzer": {
                            "type": "custom",
                            "tokenizer": "seunjeon_tokenizer"
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
                            engine: "faiss", 
                            space_type: "innerproduct" 
                        }
                    },
                    content: { type: "text", analyzer: "korean_analyzer" },
                    title: { type: "text", analyzer: "korean_analyzer" },
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
    console.log('Index created successfully.');

    // 3. DynamoDB 전체 스캔 및 데이터 적재
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    let totalProcessed = 0;

    do {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            Limit: 50,
            ExclusiveStartKey: lastEvaluatedKey,
            FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk) AND #visibility = :public',
            ExpressionAttributeNames: {
                '#visibility': 'visibility'
            },
            ExpressionAttributeValues: {
                ':pk': { S: 'POST#' },
                ':sk': { S: 'METADATA' },
                ':public': { S: 'public' }
            }
        });

        const response: ScanCommandOutput = await ddbClient.send(command);
        const items = response.Items || [];
        lastEvaluatedKey = response.LastEvaluatedKey;

        if (items.length === 0) continue;

        console.log(`Processing batch of ${items.length} posts...`);

        const bulkOperations: any[] = [];

        for (const item of items) {
            const post = unmarshall(item);
            if (post.isDeleted) continue;

            const chunks = splitIntoChunks(post.content);

            // 병렬 임베딩 (Rate Limit 주의: 필요시 p-limit 등으로 제한 가능)
            const chunkDocs = await Promise.all(chunks.map(async (chunkText, index) => {
                try {
                    const vector = await getEmbedding(chunkText);
                    return {
                        postId: `${post.postId}_${index}`,
                        parentPostId: post.postId,
                        chunkIndex: index,
                        title: post.title,
                        content: chunkText,
                        content_vector: vector,
                        tags: post.tags,
                        authorNickname: post.authorNickname,
                        createdAt: post.createdAt,
                        thumbnailUrl: post.thumbnailUrl,
                        status: post.status,
                        visibility: post.visibility,
                        isDeleted: false,
                    };
                } catch (err) {
                    console.error(`Failed to embed chunk for post ${post.postId}:`, err);
                    return null;
                }
            }));

            chunkDocs.forEach(doc => {
                if (doc) {
                    bulkOperations.push({ index: { _index: INDEX_NAME, _id: doc.postId } });
                    bulkOperations.push(doc);
                }
            });
        }

        if (bulkOperations.length > 0) {
            try {
                const bulkResponse = await opensearchClient.bulk({ body: bulkOperations });
                if (bulkResponse.body.errors) {
                    const failedItems = bulkResponse.body.items.filter((item: any) => item.index?.error);
                    console.error('Bulk errors (first 3):', JSON.stringify(failedItems.slice(0, 3), null, 2));
                }
                totalProcessed += items.length;
                console.log(`Processed ${totalProcessed} posts so far...`);
            } catch (err) {
                console.error('Bulk upload failed:', err);
            }
        }

    } while (lastEvaluatedKey);

    console.log('Migration completed successfully!');
}

migrate().catch(console.error);