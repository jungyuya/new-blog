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
  await ddbDocClient.send(command);
}