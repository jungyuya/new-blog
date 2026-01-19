// 파일 위치: apps/backend/src/services/chat.service.ts

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
// [신규] Bedrock 및 OpenSearch 클라이언트 추가
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';


const TABLE_NAME = process.env.TABLE_NAME!;
const DAILY_LIMIT = 50;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;

// 클라이언트 초기화
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const opensearchClient = new Client({
    ...AwsSigv4Signer({
        region: REGION,
        service: 'es',
    }),
    node: OPENSEARCH_ENDPOINT,
});

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (UTC 기준)
function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

interface QuotaStatus {
    remaining: number;
    total: number;
    isExceeded: boolean;
}

/**
 * 현재 남은 쿼터(질문 횟수)를 조회합니다.
 */
export async function getQuota(): Promise<QuotaStatus> {
    const today = getTodayDateString();
    const pk = `RATE_LIMIT#${today}`;
    const sk = 'GLOBAL_COUNTER';

    try {
        const { Item } = await ddbDocClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk }
        }));

        const used = Item?.count || 0;
        const remaining = Math.max(0, DAILY_LIMIT - used);

        return {
            remaining,
            total: DAILY_LIMIT,
            isExceeded: remaining <= 0
        };
    } catch (error) {
        console.error('Failed to get quota:', error);
        // 에러 시 안전하게 0으로 반환하거나 에러를 던질 수 있음
        return { remaining: 0, total: DAILY_LIMIT, isExceeded: true };
    }
}

/**
 * 쿼터를 1회 차감(사용)합니다.
 * 성공하면 true, 한도가 초과되었으면 false를 반환합니다.
 */
export async function useQuota(): Promise<boolean> {
    const today = getTodayDateString();
    const pk = `RATE_LIMIT#${today}`;
    const sk = 'GLOBAL_COUNTER';

    // 내일 자정(TTL) 계산: 데이터 자동 삭제용
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const ttl = Math.floor(tomorrow.getTime() / 1000);

    try {
        // Atomic Counter: 읽고 쓰는게 아니라, DB에게 "더해줘!"라고 명령함.
        // ConditionExpression: "현재 count가 50보다 작을 때만 더해줘"
        await ddbDocClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk },
            UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
            ConditionExpression: '#count < :limit OR attribute_not_exists(#count)',
            ExpressionAttributeNames: {
                '#count': 'count',
                '#ttl': 'ttl'
            },
            ExpressionAttributeValues: {
                ':inc': 1,
                ':zero': 0,
                ':limit': DAILY_LIMIT,
                ':ttl': ttl
            }
        }));

        return true; // 성공적으로 증가시킴 (사용 가능)
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return false; // 이미 한도 초과됨
        }
        console.error('Failed to use quota:', error);
        throw error;
    }
}


// 사용자 질문에 대한 RAG 답변을 생성합니다.

export async function generateAnswer(question: string): Promise<string> {
  try {
    // 1. 질문 벡터화 (Embedding)
    const embeddingCommand = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: question }),
    });
    const embeddingResponse = await bedrockClient.send(embeddingCommand);
    const embeddingBody = JSON.parse(new TextDecoder().decode(embeddingResponse.body));
    const questionVector = embeddingBody.embedding;

    // 2. OpenSearch 벡터 검색 (Retrieval)
    const searchResponse = await opensearchClient.search({
      index: 'posts',
      body: {
        size: 3, // 가장 유사한 문서 3개만 가져옴
        query: {
          knn: {
            content_vector: {
              vector: questionVector,
              k: 3, // k-NN 파라미터
            },
          },
        },
        _source: ['content', 'title'], // 필요한 필드만 가져옴
      },
    });

    const hits = searchResponse.body.hits.hits;
    const contexts = hits.map((hit: any) => hit._source.content).join('\n\n');
    
    // 검색 결과가 없으면 일반적인 대답
    if (!contexts) {
      return "죄송합니다. 관련 정보를 블로그에서 찾을 수 없습니다.";
    }

    // 3. 답변 생성 (Generation) - Claude 3 Haiku
    const prompt = `
      Human: 너는 이 기술 블로그의 AI 어시스턴트야.
      아래 제공된 <context> 태그 안의 내용만을 바탕으로 사용자의 질문에 답변해.
      만약 <context>에 없는 내용이라면 "블로그 내용 중에 관련 정보를 찾을 수 없습니다"라고 말해.
      답변은 친절하고 간결하게 해줘.

      <context>
      ${contexts}
      </context>

      사용자 질문: ${question}

      Assistant:`;

    const chatCommand = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    const chatResponse = await bedrockClient.send(chatCommand);
    const chatBody = JSON.parse(new TextDecoder().decode(chatResponse.body));
    return chatBody.content[0].text;

  } catch (error) {
    console.error('RAG Error:', error);
    throw new Error('Failed to generate answer.');
  }
}