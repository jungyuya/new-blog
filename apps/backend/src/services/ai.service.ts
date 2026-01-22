// 파일 위치: apps/backend/src/services/ai.service.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import * as postsRepository from '../repositories/posts.repository';

const TABLE_NAME = process.env.TABLE_NAME!;
const REGION = process.env.REGION!;

// --- 안전한 JSON 추출 헬퍼 함수 ---
function extractJsonObject(text: string): any {
  const cleanedText = text.replace(/^```json\s*|```$/g, '');
  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No valid JSON object found in AI response.');
  }
  const jsonText = cleanedText.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonText);
}

/**
 * 게시물에 대한 AI 요약을 생성하거나 캐시된 요약을 반환합니다.
 * @param postId 요약을 생성할 게시물의 ID
 * @returns 요약, 키워드, 그리고 출처(cache 또는 live)
 */
export async function getAiSummaryForPost(postId: string) {
  // 1. DB에서 게시물 원본을 가져옵니다. (posts.repository.ts 재사용)
  const post = await postsRepository.findPostById(postId);

  if (!post) {
    return { status: 'not_found' };
  }

  // 2. 캐시 확인: aiSummary가 이미 존재하는지 확인합니다.
  if (post.aiSummary) {
    console.log(`[AI Summary] Cache hit for postId: ${postId}`);
    return {
      status: 'success',
      data: {
        summary: post.aiSummary,
        keywords: post.aiKeywords || [],
        source: 'cache',
      },
    };
  }

  console.log(`[AI Summary] Cache miss for postId: ${postId}. Invoking Bedrock...`);
  // 3. 캐시 없음 (Cache Miss): Bedrock을 호출하여 새로 생성합니다.
  const bedrockClient = new BedrockRuntimeClient({ region: REGION });

  const textOnlyContent = (post.content || '')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '').replace(/<[^>]*>?/gm, ' ')
    .replace(/[#*`_~=\->|]/g, '').replace(/\s+/g, ' ').trim();

  if (textOnlyContent.length < 50) {
    return { status: 'too_short' };
  }

  const prompt = `
    Human: 당신은 IT 기술 블로그의 전문 에디터입니다. 모든 답변은 반드시 한국어 존댓말로, 그리고 지정된 JSON 형식으로만 응답해야 합니다. 
    당신의 임무는 주어진 기술 게시물을 분석하여, 독자들이 글의 핵심 내용을 40초 안에 파악할 수 있도록 **간결하고 명확한** 요약문을 생성하는 것입니다.
    다음 <article> 태그 안의 내용을 분석하여, 아래 <output_format> 형식과 **제약 조건**에 맞춰 결과를 JSON 객체로 출력해주세요.
    <article>${textOnlyContent.substring(0, 10000)}</article>
    <output_format>
    { "summary": ["1. ...", "2. ...", "3. ..."], "keywords": ["...", "...", "..."] }
    </output_format>
    **제약 조건:**
    - **요약:** 각 문장은 **숫자와 점(예: "1. ")으로 시작**하고, **반드시 80자 내외**로 작성해주세요.
    - **키워드:** 가장 핵심적인 키워드 3개만 추출합니다.
    - **출력:** 다른 설명 없이, 오직 유효한 JSON 객체만 출력해야 합니다.
    Assistant:`;

  const bedrockCommand = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const apiResponse = await bedrockClient.send(bedrockCommand);
  const decodedBody = new TextDecoder().decode(apiResponse.body);
  const responseBody = JSON.parse(decodedBody);
  const aiResultText = responseBody.content?.[0]?.text ?? '';
  const aiResultJson = extractJsonObject(aiResultText);

  const newSummary = Array.isArray(aiResultJson.summary) ? aiResultJson.summary.join('\n') : String(aiResultJson.summary || '');
  const keywords = Array.isArray(aiResultJson.keywords) ? aiResultJson.keywords : [];

  // 4. 생성된 요약을 DB에 저장(캐싱)합니다.
  // TODO: 이 로직은 posts.repository.ts로 이전하는 것이 더 이상적입니다.
  await ddbDocClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    UpdateExpression: 'SET aiSummary = :summary, aiKeywords = :keywords',
    ExpressionAttributeValues: { ':summary': newSummary, ':keywords': keywords },
  }));

  return {
    status: 'success',
    data: { summary: newSummary, keywords, source: 'live' },
  };
}

/**
 * 게시물의 AI 요약 캐시를 삭제합니다.
 * @param postId 캐시를 삭제할 게시물의 ID
 */
export async function clearAiSummaryCache(postId: string) {
  // TODO: 이 로직은 posts.repository.ts로 이전하는 것이 더 이상적입니다.
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    UpdateExpression: 'REMOVE aiSummary, aiKeywords',
  });
}

/**
 * 사용자 질문을 검색에 최적화된 형태로 확장/변환합니다. (Query Expansion)
 * @param query 사용자 원본 질문
 * @returns refinedQuery(검색용 문장), keywords(검색용 키워드 배열)
 */
export async function expandQuery(query: string, history: { role: 'user' | 'assistant'; content: string }[] = []): Promise<{ refinedQuery: string; keywords: string[] }> {
  const bedrockClient = new BedrockRuntimeClient({ region: REGION });

  // 최근 대화 기록 포맷팅 (최대 4개)
  const historyText = history.slice(-4).map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');

  // 프롬프트: 사용자의 의도를 파악하고, 검색 엔진이 이해하기 쉬운 형태의 문장과 키워드로 변환
  const prompt = `
    Human: 당신은 검색 쿼리 최적화 전문가입니다. 사용자의 질문을 분석하여 OpenSearch(Vector + Keyword) 검색 성능을 높일 수 있는 "정제된 질문(refinedQuery)"과 "핵심 키워드(keywords)"를 추출해주세요.
    
    <chat_history>
    ${historyText}
    </chat_history>

    <user_query>${query}</user_query>
    
    <output_format>
    { "refinedQuery": "검색 엔진에 입력할 최적화된 단일 문장 (한국어)", "keywords": ["키워드1", "키워드2", "영어키워드(필요시)"] }
    </output_format>
    
    **지침:**
    1. **Context Awareness**: <chat_history>를 참고하여 <user_query>의 모호한 대명사(그거, 이거, 아까 말한 거 등)를 구체적인 대상으로 치환하세요. (예: History "CDK 에러", Query "그거 해결법" -> Refined "CDK 에러 해결 방법")
    2. **Refined Query**: 불주제어(은/는/이/가 등)를 제거하거나, 검색 의도를 명확히 하는 문장으로 변환하세요.
    3. **Keywords**: 명사 위주의 핵심 단어 3~5개를 추출하세요. 기술 용어는 영어 원문을 포함하는 것이 좋습니다.
    4. 오직 유효한 JSON 객체만 출력하세요.
    
    Assistant:`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const decodedBody = new TextDecoder().decode(response.body);
    const responseBody = JSON.parse(decodedBody);
    const contentText = responseBody.content?.[0]?.text ?? '';
    const result = extractJsonObject(contentText);

    return {
      refinedQuery: result.refinedQuery || query,
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
    };
  } catch (error) {
    console.warn('[Query Expansion] Failed to expand query, using original query.', error);
    // 실패 시 원본 쿼리 반환
    return { refinedQuery: query, keywords: [] };
  }
}