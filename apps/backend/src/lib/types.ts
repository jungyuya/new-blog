// 파일 위치: apps/backend/src/lib/types.ts (v1.1 - UserContext 추가)
import type { LambdaEvent } from 'hono/aws-lambda';

// [신규] cookieAuthMiddleware가 c.set()으로 설정하는 user 객체의 타입을 정의합니다.
export type UserContext = {
  userId: string;
  userEmail: string;
  userGroups: string[];
  nickname: string;
  avatarUrl?: string;
};

// Hono의 Bindings와 Variables 타입을 전역적으로 정의합니다.
export type AppEnv = {
  Bindings: {
    event: LambdaEvent;
  };
  Variables: {
    // [수정] 기존 타입들은 남겨두되, user 객체를 새로 추가합니다.
    // cookieAuthMiddleware를 거치지 않은 라우트에서는 user가 undefined일 수 있으므로 '?'를 붙입니다.
    user?: UserContext;
    
    // 기존 타입들은 tryCookieAuthMiddleware 등에서 여전히 사용될 수 있으므로 유지합니다.
    userId?: string;
    userEmail?: string;
    userGroups?: string[];
  };
};

export interface Post {
  // ... (이하 Post 인터페이스는 변경 없음)
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