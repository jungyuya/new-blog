// 파일 위치: apps/frontend/src/components/comments/CommentsSection.tsx (v2.2 - 답글 기능 완성)
'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/utils/api';
import CommentForm from './CommentForm';
import CommentList from './CommentList';

interface CommentsSectionProps {
  postId: string;
}

const commentsFetcher = ([key, postId]: [string, string]) => api.fetchCommentsByPostId(postId);

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments, error, isLoading, mutate } = useSWR(
    ['comments', postId],
    commentsFetcher,
    { revalidateOnFocus: true }
  );

  // 최상위 댓글 제출 핸들러 (변경 없음)
  const handleCreateComment = async (content: string) => {
    setIsSubmitting(true);
    try {
      await api.createComment(postId, { content });
      await mutate();
    } catch (err) {
      console.error('Failed to create comment:', err);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- [신규] 답글(대댓글) 제출 핸들러 ---
  const handleReplySubmit = async (content: string, parentCommentId: string, parentCreatedAt: string) => {
    setIsSubmitting(true);
    try {
      // API 호출 시 parentCommentId와 parentCreatedAt을 함께 전달
      await api.createComment(postId, { content, parentCommentId, parentCreatedAt });
      await mutate(); // 캐시 갱신
    } catch (err) {
      console.error('Failed to create reply:', err);
      alert('답글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="py-8 mt-8 border-t border-gray-200">
        <h3 className="text-xl font-bold">댓글</h3>
        <div className="py-4 text-center text-gray-500">댓글을 불러오는 중입니다...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 mt-8 border-t border-gray-200">
        <h3 className="text-xl font-bold">댓글</h3>
        <div className="py-4 text-center text-red-500">
          댓글을 불러오는 데 실패했습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 mt-8 border-t border-gray-200">
      <h3 className="text-xl font-bold">댓글 ({comments?.length || 0})</h3>
      <CommentForm
        onSubmit={handleCreateComment}
        isSubmitting={isSubmitting}
      />
      {comments && comments.length > 0 ? (
        <CommentList
          comments={comments}
          postId={postId} // [신규]
          onReplySubmit={handleReplySubmit}
          isSubmitting={isSubmitting}
          onUpdate={mutate} // [신규] SWR의 mutate 함수를 onUpdate prop으로 전달
        />
      ) : (
        <div className="py-4 text-center text-gray-500">
          아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
        </div>
      )}
    </section>
  );
}