// 파일 위치: apps/backend/src/indexing-handler.ts
// [임시 비활성화] OpenSearch 삭제로 인한 인덱싱 중단
// 향후 Supabase pgvector 이관 완료 후 재활성화 예정 (RAG_change_plan.md 참조)

import { DynamoDBStreamEvent } from 'aws-lambda';

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('[IndexingLambda] 인덱싱 일시 중단 중 (OpenSearch 제거 후 Supabase 이관 대기)');
  console.log(`수신된 레코드 수: ${event.Records.length}`);
  // TODO: Supabase pgvector 이관 완료 후 RAG_change_plan.md의 Phase 2 코드로 교체
  return;
};