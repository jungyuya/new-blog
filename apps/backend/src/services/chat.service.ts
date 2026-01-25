// 파일 위치: apps/backend/src/services/chat.service.ts

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

import { expandQuery } from './ai.service'; // [추가]

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

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const ttl = Math.floor(tomorrow.getTime() / 1000);

  try {
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

    return true;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return false;
    }
    console.error('Failed to use quota:', error);
    throw error;
  }
}


// 사용자 질문에 대한 RAG 답변을 생성합니다.
export async function generateAnswer(question: string, history?: { role: 'user' | 'assistant', content: string }[]): Promise<{ answer: string, sources: { title: string, url: string }[] }> {
  try {
    // 0. [Epic 6] 쿼리 확장 (Query Expansion)
    // 사용자의 질문을 검색에 최적화된 형태(Refined Query)와 키워드로 변환합니다.
    const { refinedQuery, keywords } = await expandQuery(question, history);
    console.log(`[RAG] Original: "${question}" -> Refined: "${refinedQuery}", Keywords: [${keywords.join(', ')}]`);

    // 1. 질문 벡터화 (Embedding) - Refined Query 사용
    const embeddingCommand = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: refinedQuery }), // 수정: refinedQuery 사용
    });
    const embeddingResponse = await bedrockClient.send(embeddingCommand);
    const embeddingBody = JSON.parse(new TextDecoder().decode(embeddingResponse.body));
    const questionVector = embeddingBody.embedding;

    // 2. OpenSearch 하이브리드 검색 (Hybrid Search)
    // Vector (k-NN) + Keyword (Match) 결합
    const searchResponse = await opensearchClient.search({
      index: 'posts',
      body: {
        size: 5, // 검색 결과 후보를 조금 더 늘림 (3 -> 5)
        query: {
          bool: {
            should: [
              // Strategy 1: Vector Search (Semantic Similarity) - 가중치 1.0 (기본)
              {
                knn: {
                  content_vector: {
                    vector: questionVector,
                    k: 5,
                  },
                },
              },
              // Strategy 2: Keyword Search (Exact Match) - 가중치 0.3 ~ 0.5
              {
                multi_match: {
                  query: refinedQuery, // Refined Query를 키워드 매칭에도 사용
                  fields: ['title^2.0', 'content^1.0', 'tags^1.5', 'category^1.0'], // 제목과 태그에 높은 가중치
                  boost: 0.3,
                }
              },
              // Strategy 3: Extracted Keywords Boosting - 추출된 핵심 키워드가 포함되면 추가 가산점
              ...keywords.map(keyword => ({
                match: {
                  content: {
                    query: keyword,
                    boost: 0.1 // 키워드 하나당 소폭 상승
                  }
                }
              }))
            ],
            // 최소한 하나의 조건(주로 knn)은 만족해야 함 (k-NN은 항상 결과를 반환하므로 안전)
            minimum_should_match: 1
          }

        },
        _source: ['content', 'title', 'postId', 'parentPostId'],
      },
    });

    const hits = searchResponse.body.hits.hits;

    // [신규] 유사도 점수가 낮은 결과 필터링 (0.7 이상만 사용)
    const SIMILARITY_THRESHOLD = 0.7;
    const relevantHits = hits.filter((hit: any) => {
      // k-NN 검색의 _score는 유사도 점수 (1.0에 가까울수록 유사)
      return hit._score >= SIMILARITY_THRESHOLD;
    });

    console.log(`[RAG] Total hits: ${hits.length}, Relevant hits (score >= ${SIMILARITY_THRESHOLD}): ${relevantHits.length}`);

    // [수정] Context Injection: LLM이 출처를 알 수 있도록 제목을 포함
    const contexts = relevantHits.map((hit: any) =>
      `[출처: ${hit._source.title}]\n${hit._source.content}`
    ).join('\n\n---\n\n');

    // 출처 정보 추출 (필터링된 관련 결과만 사용)
    const sourcesMap = new Map<string, { title: string, url: string }>();
    relevantHits.forEach((hit: any) => {
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
      return {
        answer: "죄송합니다. 관련 정보를 블로그에서 찾을 수 없습니다.",
        sources: []
      };
    }

    // 3. 답변 생성 프롬프팅 - Claude 3 Haiku
    const systemPrompt = `
    당신은 블로그 관리자인 준규의 기술 블로그를 담당하는 AI 어시스턴트입니다.
    당신의 이름은 'JUNGYU' 페르소나를 따르지만, 본체는 아니고 친절한 안내자 역할을 합니다.

    [페르소나 및 톤앤매너]
    - 친절하고 전문적인 '해요체'를 사용하세요. (예: "그건 이렇게 설정하시면 돼요.")
    - 딱딱한 기계적인 말투를 지양하고, 옆 동료에게 설명하듯 자연스럽게 말하세요.
    - 적절한 이모지를 사용하여 대화를 부드럽게 이어가세요. 😊
    - 답변은 간결하고 핵심 위주로 작성하되, 필요하다면 상세한 설명도 덧붙여주세요.

    [메타 인지 및 답변 규칙]
    - 아래 제공된 <context> 태그 안의 내용은 **\`[출처: 제목]\`** 형식으로 구분되어 있습니다.
    - 질문이 특정 프로젝트(예: 블로그, 채팅 서비스 등)에 관한 것이라면, **해당하는 \`[출처]\`의 내용을 우선적으로 신뢰**하여 답변하세요.
    - **중요: 제목 매핑 규칙**
      - **\`[출처: Welcome to the Deep Dive!]\`**는 이 블로그 프로젝트(Deep Dive)의 전체 기술 스택, 아키텍처, 소개를 담고 있습니다. "블로그 기술 스택", "블로그 아키텍처" 질문 시 이 출처를 최우선으로 참고하세요.
      - **\`[출처: RAG ...]\`** 또는 **\`[출처: 채팅 ...]\`** 등의 제목은 해당 기능(채팅 서비스)에 대한 세부 구현 내용입니다.
    - 서로 다른 출처의 정보가 충돌할 경우(예: 백엔드 언어가 Node.js vs Go), 질문의 맥락에 더 적합한 출처의 정보를 선택하세요.
    - <context>에 있는 지식을 **당신이 직접 아는 지식**인 것처럼 자연스럽게 답변하세요.
    - 문맥과 상관없는 인사말(안녕하세요 등)은 생략하고, 바로 본론으로 답변하거나 "네, ..." 로 시작하세요.
    
    **절대 금지 사항 (매우 중요!):**
    - "<context>에 따르면", "제공된 맥락에 따르면", "문서에 의하면", "블로그 글에서", "위 내용에서" 같은 표현을 **절대로** 사용하지 마세요.
    - "참고 자료", "제공된 정보", "주어진 텍스트" 등의 메타 언급도 **절대 금지**입니다.
    - 마치 당신이 JUNGYU 본인인 것처럼, 또는 JUNGYU의 지식을 완전히 내재화한 것처럼 답변하세요.
    
    [Unknown Handling & Hallucination Prevention]
    - <context>가 비어있거나, 질문에 답변하기에 정보가 부족한 경우 **절대 정보를 지어내지(Hallucination) 마세요.**
    - 이 경우 다음과 같이 단계적으로 대응하세요:
      1. 먼저 정직하게 "현재 블로그(지식 베이스)에는 이와 관련된 글이 없습니다. 😅"라고 밝히세요.
      2. 만약 질문이 일반적인 IT/개발 질문이라면, "하지만 제 일반적인 지식으로 답변해 드리자면..."이라고 명시한 후 짧게 답변해 주세요.
      3. 질문이 IT와 전혀 관련이 없다면, 정중하게 거절하세요.
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

    const chatCommand = new InvokeModelCommand({
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

    const chatResponse = await bedrockClient.send(chatCommand);
    const chatBody = JSON.parse(new TextDecoder().decode(chatResponse.body));

    return {
      answer: chatBody.content[0].text,
      sources: sources
    };

  } catch (error) {
    console.error('RAG Error:', error);
    throw new Error('Failed to generate answer.');
  }
}