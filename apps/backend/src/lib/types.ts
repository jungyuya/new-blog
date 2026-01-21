// 파일 위치: apps/backend/src/lib/types.ts (v1.3 - aiSummary 추가)
import type { LambdaEvent } from 'hono/aws-lambda';

export type UserContext = {
  userId: string;
  userEmail: string;
  userGroups: string[];
  nickname: string;
  avatarUrl?: string;
};

export type AppEnv = {
  Bindings: {
    event: LambdaEvent;
  };
  Variables: {
    user?: UserContext;
    userId?: string;
    userEmail?: string;
    userGroups?: string[];
    anonymousId?: string;
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
  likeCount?: number;
  commentCount?: number;
  aiSummary?: string;
  // --- [핵심 수정] GSI 키들을 선택적 속성으로 추가합니다. ---
  GSI1_PK?: string;
  GSI1_SK?: string;
  GSI3_PK?: string;
  GSI3_SK?: string;
  aiKeywords?: string[];
  speechUrl?: string;
  speechStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  showToc?: boolean;
  // --- [Epic 6] 지식 베이스 확장을 위한 필드 추가 ---
  category?: 'post' | 'learning'; // 기본값: 'post'
  ragIndex?: boolean;             // 기본값: 공개글 true, 비밀글 false (하지만 true로 설정 가능)
};

export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}