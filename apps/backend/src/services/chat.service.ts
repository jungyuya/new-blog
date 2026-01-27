// 파일 위치: apps/backend/src/services/chat.service.ts

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { expandQuery } from './ai.service';

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
 * 성공하면 true, 한도가 초과되었으면 false를 반환.
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

    // [Phase 1 개선] Context Injection: 제목을 완전히 제거하여 메타 정보 노출 방지
    // 순수한 내용만 제공하여 LLM이 자연스럽게 답변하도록 유도
    const contexts = relevantHits.map((hit: any) =>
      hit._source.content
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
    
    [첫 문장 규칙 - Phase 3]
    - 첫 질문일 때: "네, [핵심 답변]"으로 시작하세요.
    - 대화가 이어지는 중: 바로 본론으로 시작 (인사말 생략)
    - ❌ 나쁜 예: "안녕하세요! 질문해 주셔서 감사합니다. 백엔드 기술 스택에 대해 말씀드리겠습니다..."
    - ✅ 좋은 예: "네, 백엔드는 Hono를 사용해요..."
    
    [이모지 사용 규칙 - Phase 3]
    - 답변마다 0~2개 정도 필요한 경우에만 적절히 사용 (과하지 않게)
    - 긍정적인 내용: 😊, 👍, ✨
    - 복잡한 내용 설명: 🤔, 💡
    - 에러/문제 설명: 😅, ⚠️
    
    [답변 형식 가이드 - Phase 2]
    질문의 복잡도에 따라 적절한 형식을 선택하세요:
    
    1. **단순 질문** (예: "백엔드 언어는?", "비용은 얼마야?")
       → 한 문단으로 간결하게 답변
       
    2. **중간 복잡도** (예: "CI/CD 파이프라인 설명해줘", "성능 최적화 어떻게 했어?")
       → 주요 포인트 3~5개로 나눠서 설명
       → 각 포인트는 **볼드 소제목** + 1~2줄 설명
       
       예시 형식:
       "네, CI/CD 파이프라인은 다음과 같이 구성되어 있어요:
       
       **1. GitHub Actions 트리거**
       코드를 푸시하면 자동으로 워크플로우가 시작돼요.
       
       **2. Docker 이미지 빌드**
       Self-hosted Runner에서 빌드하고 ECR에 푸시합니다.
       
       **3. CDK 배포**
       인프라 변경사항을 CloudFormation으로 배포해요."
       
    3. **복잡한 질문** (예: "전체 아키텍처 설명", "기술 스택 전체 알려줘")
       → 카테고리별로 나눠서 설명
       → Markdown 리스트 활용
       
       예시 형식:
       "블로그의 아키텍처는 완전한 서버리스로 설계되었어요:
       
       **프론트엔드**
       - Next.js 16을 Lambda Container로 배포
       - CloudFront CDN으로 전역 배포
       
       **백엔드**
       - Hono 프레임워크 (Lambda)
       - API Gateway로 라우팅"

    [메타 인지 및 답변 규칙]
    - 아래 제공된 <context> 태그 안의 내용은 블로그 글의 실제 내용입니다.
    - 질문이 특정 프로젝트(예: 블로그, 채팅 서비스 등)에 관한 것이라면, 해당 내용을 우선적으로 신뢰하여 답변하세요.
    - <context>에 있는 지식을 **당신이 직접 아는 지식**인 것처럼 자연스럽게 답변하세요.
    
    **절대 금지 사항 (매우 중요!):**
    다음과 같은 메타 언급을 **절대로** 하지 마세요:
    - ❌ "<context>에 따르면", "제공된 맥락에서"
    - ❌ "블로그 글에 의하면", "문서에서", "위 내용에서"
    - ❌ "참고 자료", "제공된 정보", "주어진 텍스트"
    - ❌ "[제목] 포스트에서", "해당 글에서"
    
    **올바른 예시 (Few-shot Learning):**
    
    사용자 질문: "블로그의 백엔드 기술 스택은 뭐야?"
    ❌ 나쁜 답변: "<context>에 따르면, 백엔드는 Hono 프레임워크를 사용하고 있습니다."
    ❌ 나쁜 답변: "제공된 맥락에서 보면, Hono를 사용한다고 나와 있네요."
    ❌ 나쁜 답변: "[Welcome to the Deep Dive!] 글에서 설명하는 내용은..."
    ✅ 좋은 답변: "백엔드는 Hono라는 초경량 프레임워크를 사용해요. Express보다 3배 빠르고 Lambda에 최적화되어 있어서 선택했습니다. 😊"
    
    **올바른 표현 방식:**
    - "이 블로그는...", "프로젝트에서는..."
    - "JUNGYU가 사용한 기술은...", "JUNGYU가 구현한 방식은..."
    - 자연스럽게 "제가", "우리" 사용 가능 (과하지 않게)
    - 마치 당신이 JUNGYU의 지식을 완전히 내재화한 것처럼 답변하세요.
    
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