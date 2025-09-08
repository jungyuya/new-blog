// 파일 위치: apps/frontend/src/components/comments/CommentList.tsx (v2.1 - props 전달 추가)
'use client';

import React from 'react';
import { Comment } from '@/utils/api';
import CommentItem from './CommentItem';

// [수정] 부모로부터 받을 props 타입을 확장합니다.
interface CommentListProps {
  comments: Comment[];
  onReplySubmit: (content: string, parentCommentId: string, parentCreatedAt: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function CommentList({ comments, onReplySubmit, isSubmitting }: CommentListProps) {
  return (
    <div className="mt-6 first:mt-0">
      {comments.map((comment) => (
        // [수정] 자식 CommentItem에게 props를 그대로 전달합니다.
        <CommentItem 
          key={comment.commentId} 
          comment={comment} 
          onReplySubmit={onReplySubmit}
          isSubmitting={isSubmitting}
        />
      ))}
    </div>
  );
}