// 파일 위치: apps/frontend/src/components/comments/CommentList.tsx (v2.1 - props 전달 추가)
'use client';

import React from 'react';
import type { KeyedMutator } from 'swr'; // SWR의 mutate 함수 타입을 가져옵니다.
import { Comment } from '@/utils/api';
import CommentItem from './CommentItem';

interface CommentListProps {
  comments: Comment[];
  postId: string; // [신규]
  onReplySubmit: (content: string, parentCommentId: string, parentCreatedAt: string) => Promise<void>;
  isSubmitting: boolean;
  onUpdate: KeyedMutator<Comment[]>;
}

export default function CommentList({ comments, postId, onReplySubmit, isSubmitting, onUpdate }: CommentListProps) {
  return (
    <div className="mt-6 first:mt-0">
      {comments.map((comment) => (
        <CommentItem 
          key={comment.commentId} 
          comment={comment} 
          postId={postId} // [신규]
          onReplySubmit={onReplySubmit}
          isSubmitting={isSubmitting}
          onUpdate={onUpdate} // [신규]
        />
      ))}
    </div>
  );
}