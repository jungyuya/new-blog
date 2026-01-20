// 파일 위치: apps/backend/src/services/chat.service.ts

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
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


// 사용자 질문에 대한 RAG 답변을 생성합니다. (스트리밍 버전)
export async function generateAnswerStream(question: string, history?: { role: 'user' | 'assistant', content: string }[]): Promise<{ stream: AsyncGenerator<string>, sources: { title: string, url: string }[] }> {
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
        size: 3,
        query: {
          knn: {
            content_vector: {
              vector: questionVector,
              k: 3,
            },
          },
        },
        _source: ['content', 'title', 'postId', 'parentPostId'],
      },
    });

    const hits = searchResponse.body.hits.hits;
    const contexts = hits.map((hit: any) => hit._source.content).join('\n\n');

    // 출처 정보 추출
    const sourcesMap = new Map<string, { title: string, url: string }>();
    hits.forEach((hit: any) => {
      const source = hit._source;
      let originalPostId = source.parentPostId;
      if (!originalPostId && source.postId) {
        originalPostId = source.postId.split('_')[0];
      }

      if (originalPostId && source.title) {
        sourcesMap.set(originalPostId, {
          title: source.title,
          url: `https://blog.jungyu.store/posts/${originalPostId}`
        });
      }
    });
    const sources = Array.from(sourcesMap.values());

    // 검색 결과가 없으면
    if (!contexts) {
      async function* emptyStream() {
        yield "죄송합니다. 관련 정보를 블로그에서 찾을 수 없습니다.";
      }
      return { stream: emptyStream(), sources: [] };
    }

    // 3. 답변 생성 (Stream) - Claude 3 Haiku
    const systemPrompt = `
    당신은 'JUNGYU'의 기술 블로그를 담당하는 AI 어시스턴트입니다.
    당신의 이름은 'JUNGYU' 페르소나를 따르지만, 본체는 아니고 친절한 안내자 역할을 합니다.

    [페르소나 및 톤앤매너]
    - 친절하고 전문적인 '해요체'를 사용하세요. (예: "그건 이렇게 설정하시면 돼요.")
    - 딱딱한 기계적인 말투를 지양하고, 옆 동료에게 설명하듯 자연스럽게 말하세요.
    - 적절한 이모지를 사용하여 대화를 부드럽게 이어가세요. 😊
    - 답변은 간결하고 핵심 위주로 작성하되, 필요하다면 상세한 설명도 덧붙여주세요.

    [메타 인지 및 답변 규칙]
    - 아래 제공된 <context> 태그 안의 내용(블로그 글)을 기반으로 답변해야 합니다.
    - <context>에 있는 지식을 당신의 머릿속에 있는 지식인 것처럼 자연스럽게 답변하세요. 
    - **중요**: "제공된 맥락에 따르면"이나 "문서에 의하면" 같은 기계적인 표현을 절대 사용하지 마세요. 그냥 당신이 아는 것을 말하듯 하세요.
    - 만약 사용자의 질문에 대한 정보가 <context>에 전혀 없다면, 솔직하게 "해당 내용은 제 블로그에 아직 정리되지 않은 것 같아요. 😅"라고 말하고, 일반적인 클라우드 지식을 바탕으로 짧게 답변해 줄 수는 있습니다. 단, 이 경우 "제 블로그 내용은 아니지만..."이라고 명시해주세요.
    `;

    const userPrompt = `
    <context>
    ${contexts}
    </context>

    사용자 질문: ${question}
    `;

    const messages: any[] = [];
    if (history && history.length > 0) {
      history.slice(-6).forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }
    messages.push({ role: 'user', content: userPrompt });

    const streamCommand = new InvokeModelWithResponseStreamCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const response = await bedrockClient.send(streamCommand);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    async function* streamGenerator() {
      for await (const chunk of response.body!) {
        if (chunk.chunk && chunk.chunk.bytes) {
          const decoded = new TextDecoder().decode(chunk.chunk.bytes);
          const parsed = JSON.parse(decoded);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        }
      }
    }

    return { stream: streamGenerator(), sources };

  } catch (error) {
    console.error('RAG Error:', error);
    throw new Error('Failed to generate answer.');
  }
}