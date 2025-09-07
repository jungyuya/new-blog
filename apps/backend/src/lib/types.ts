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

export interface Post {
  PK: string;
  SK: string;
  postId: string;
  title: string;
  content: string;
  summary: string;
  authorId: string;
  authorEmail: string;
  authorNickname: string;
  authorBio?: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  status: 'published' | 'draft';
  visibility: 'public' | 'private';
  tags: string[];
  thumbnailUrl: string;
  imageUrl: string;
  isDeleted: boolean;
};