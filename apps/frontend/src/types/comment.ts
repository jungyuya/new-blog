// 파일 위치: apps/frontend/src/types/comment.ts

// API 응답으로 받는 댓글의 기본 구조
export interface Comment {
  commentId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl?: string;
  createdAt: string;
  isDeleted: boolean;
  parentCommentId: string | null;
  // 재귀적인 구조를 표현하기 위해, Comment 타입 자신이 배열로 포함
  replies: Comment[];
}