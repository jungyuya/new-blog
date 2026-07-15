// 파일 위치: apps/backend/src/services/chat.service.ts

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { expandQuery } from './ai.service';

const TABLE_NAME = process.env.TABLE_NAME!;
const DAILY_LIMIT = 50;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';

// 클라이언트 초기화
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

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
// [임시 중단] OpenSearch 제거로 RAG 기능 일시 비활성화
// 향후 Supabase pgvector 이관 완료 후 복구 예정 (RAG_change_plan.md 참조)
export async function generateAnswer(
  question: string,
  history?: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  console.log(`[RAG] 서비스 임시 중단 - 질문 수신: "${question}"`);

  return {
    answer:
      '현재 AI 챗봇 서비스는 인프라 이관 작업 중입니다. 🔧\n\n곧 더 나은 버전으로 돌아올게요! 궁금한 내용은 블로그 댓글이나 GitHub을 통해 남겨주세요.',
    sources: [],
  };
}