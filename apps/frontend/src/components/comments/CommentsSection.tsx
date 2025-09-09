// 파일 위치: apps/frontend/src/components/comments/CommentsSection.tsx (v2.2 - 답글 기능 완성)
'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/utils/api';
import CommentForm from './CommentForm';
import CommentList from './CommentList';
import { useAuth } from '@/contexts/AuthContext'; // [신규] useAuth 훅 import

interface CommentsSectionProps {
  postId: string;
}

const commentsFetcher = ([key, postId]: [string, string]) => api.fetchCommentsByPostId(postId);

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth(); // [신규] 로그인 상태 확인을 위해 user 정보 가져오기
  const [isSubmitting, setIsSubmitting] = useState(false);
  // [신규] 댓글 섹션 전체의 표시 여부를 관리하는 상태
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

  const totalComments = comments?.length || 0;

  return (
    <section className="py-8 mt-8 border-t border-gray-200">
      {/* --- [핵심 수정] 제목 부분을 클릭 가능한 버튼으로 변경 --- */}
      <div className="flex items-center mb-4">
        <button
          onClick={() => setIsSectionVisible(!isSectionVisible)}
          className="flex items-center text-xl font-bold text-gray-800 hover:text-gray-900"
        >
          <span>💬 댓글</span>
          <span className="ml-2 text-blue-600">{totalComments}</span>
          {/* 화살표 아이콘 */}
          <svg className={`w-5 h-5 ml-2 transition-transform duration-200 ${isSectionVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
      </div>

      {/* --- [핵심 수정] 댓글 폼과 목록을 isSectionVisible 상태에 따라 조건부 렌더링 --- */}
      {isSectionVisible && (
        <>
          {/* [신규] 로그인한 사용자에게만 댓글 폼을 보여줍니다. */}
          {user ? (
            <CommentForm
              onSubmit={handleCreateComment}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-md">
              댓글을 작성하려면 <a href="/login" className="text-blue-600 hover:underline">로그인</a>이 필요합니다.
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
            <div className="pt-8 text-center text-gray-500">
              아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
            </div>
          )}
        </>
      )}
    </section>
  );
}