// 파일 위치: apps/backend/src/lib/types.ts (v1.1 - UserContext 추가)
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
  // [신규] 좋아요 및 댓글 수를 Post 타입에 명시적으로 추가합니다.
  likeCount?: number;
  commentCount?: number;
};

export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}