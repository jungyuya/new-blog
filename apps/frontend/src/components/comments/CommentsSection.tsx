// 파일 위치: apps/frontend/src/components/comments/CommentsSection.tsx
'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/utils/api';
import CommentForm from './CommentForm';
import CommentList from './CommentList';
import { useAuth } from '@/contexts/AuthContext';

interface CommentsSectionProps {
  postId: string;
}

const commentsFetcher = ([_key, postId]: [string, string]) => api.fetchCommentsByPostId(postId);

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSectionVisible, setIsSectionVisible] = useState(true);

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
      // [수정] 1. 로딩 상태 컨테이너에 다크 모드 스타일 적용
      <section className="py-8 mt-8 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold dark:text-gray-100">댓글</h3>
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">댓글을 불러오는 중입니다...</div>
      </section>
    );
  }

  if (error) {
    return (
      // [수정] 1. 에러 상태 컨테이너에 다크 모드 스타일 적용
      <section className="py-8 mt-8 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold dark:text-gray-100">댓글</h3>
        <div className="py-4 text-center text-red-500 dark:text-red-400">
          댓글을 불러오는 데 실패했습니다.
        </div>
      </section>
    );
  }

  const totalComments = comments?.length || 0;

  return (
    // [수정] 1. 메인 컨테이너에 다크 모드 스타일 적용
    <section className="py-8 mt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center mb-4">
        <button
          onClick={() => setIsSectionVisible(!isSectionVisible)}
          // [수정] 2. 섹션 제목/토글 버튼에 다크 모드 스타일 적용
          className="flex items-center text-xl font-bold text-gray-800 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white"
        >
          <span>💬 댓글</span>
          <span className="ml-2 text-blue-600 dark:text-blue-400">{totalComments}</span>
          <svg className={`w-5 h-5 ml-2 transition-transform duration-200 ${isSectionVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
      </div>

      {isSectionVisible && (
        <>
          {user ? (
            <CommentForm
              onSubmit={handleCreateComment}
              isSubmitting={isSubmitting}
            />
          ) : (
            // [수정] 3. 로그인 안내문에 다크 모드 스타일 적용
            <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-md dark:bg-stone-800 dark:border-gray-700 dark:text-gray-400">
              댓글을 작성하려면 <a href="/login" className="text-blue-600 hover:underline dark:text-blue-400">로그인</a>이 필요합니다.
            </div>
          )}

          {comments && comments.length > 0 ? (
            <CommentList
              comments={comments}
              postId={postId}
              onReplySubmit={handleReplySubmit}
              isSubmitting={isSubmitting}
              onUpdate={mutate}
            />
          ) : (
            // [수정] 4. '댓글 없음' 안내문에 다크 모드 스타일 적용
            <div className="pt-8 text-center text-gray-500 dark:text-gray-400">
              아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
            </div>
          )}
        </>
      )}
    </section>
  );
}