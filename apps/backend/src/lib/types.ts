// 파일 위치: apps/backend/src/lib/types.ts
import type { LambdaEvent } from 'hono/aws-lambda';

// Hono의 Bindings와 Variables 타입을 전역적으로 정의합니다.
export type AppEnv = {
  Bindings: {
    event: LambdaEvent;
  };
  Variables: {
    userId?: string;
    userEmail?: string;
    userGroups?: string[];
  };
};