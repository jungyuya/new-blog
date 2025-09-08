// 파일 위치: apps/frontend/src/components/comments/CommentItem.tsx (v2.2 - 수정/삭제 기능 완성)
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Comment, api } from '@/utils/api'; // [수정] api import
import { useAuth } from '@/contexts/AuthContext'; // [신규] useAuth 훅 import
import CommentList from './CommentList';
import ClientOnlyLocalDate from '../ClientOnlyLocalDate';
import CommentForm from './CommentForm';
import type { KeyedMutator } from 'swr';

interface CommentItemProps {
  comment: Comment;
  postId: string; // [신규] API 호출에 postId가 필요
  onReplySubmit: (content: string, parentCommentId: string, parentCreatedAt: string) => Promise<void>;
  isSubmitting: boolean;
  onUpdate: KeyedMutator<Comment[]>; 
}

export default function CommentItem({ comment, postId, onReplySubmit, isSubmitting, onUpdate }: CommentItemProps) {
  const { user } = useAuth(); // [신규] 현재 로그인한 사용자 정보 가져오기
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // [신규] 수정 모드 상태

  // [신규] 현재 사용자가 이 댓글의 주인인지 확인
  const isOwner = user?.id === comment.authorId;

  const handleReplySubmit = async (content: string) => {
    await onReplySubmit(content, comment.commentId, comment.createdAt);
    setIsReplying(false);
  };

  // [신규] 댓글 수정 핸들러
  const handleUpdateSubmit = async (content: string) => {
    if (!isOwner) return;
    try {
      await api.updateComment(comment.commentId, { content, postId });
      await onUpdate(); // 부모의 mutate 함수 호출
      setIsEditing(false); // 수정 모드 종료
    } catch (err) {
      console.error('Failed to update comment:', err);
      alert('댓글 수정에 실패했습니다.');
    }
  };

  // [신규] 댓글 삭제 핸들러
  const handleDelete = async () => {
    if (!isOwner) return;
    if (window.confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
      try {
        await api.deleteComment(comment.commentId, { postId });
        await onUpdate(); // 부모의 mutate 함수 호출
      } catch (err) {
        console.error('Failed to delete comment:', err);
        alert('댓글 삭제에 실패했습니다.');
      }
    }
  };

  return (
    <article className="py-4 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start mb-2">
        {/* ... (Image 부분은 변경 없음) ... */}
        <div className="relative flex-shrink-0 w-8 h-8 mr-3">
          <Image src={comment.authorAvatarUrl || '/default-avatar.png'} alt={`${comment.authorNickname}의 프로필 사진`} fill className="object-cover rounded-full" sizes="32px" />
        </div>
        <div className="flex-grow">
          <div className="flex items-center">
            <span className="font-bold text-gray-800">{comment.authorNickname}</span>
            <span className="mx-2 text-gray-400">·</span>
            <ClientOnlyLocalDate dateString={comment.createdAt} />
          </div>
          
          {/* --- [수정] 수정 모드 UI --- */}
          {isEditing ? (
            <CommentForm onSubmit={handleUpdateSubmit} isSubmitting={isSubmitting} initialContent={comment.content} />
          ) : (
            comment.isDeleted ? (
              <p className="text-gray-500 italic">{comment.content}</p>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            )
          )}

          {/* --- [수정] 버튼 영역 --- */}
          {!isEditing && !comment.isDeleted && (
            <div className="flex items-center mt-2 text-sm space-x-4">
              <button onClick={() => setIsReplying(!isReplying)} className="text-gray-600 hover:text-gray-800">
                {isReplying ? '취소' : '답글 달기'}
              </button>
              {/* [신규] 소유자일 경우에만 수정/삭제 버튼 표시 */}
              {isOwner && (
                <>
                  <button onClick={() => setIsEditing(true)} className="text-gray-600 hover:text-gray-800">수정</button>
                  <button onClick={handleDelete} className="text-red-600 hover:text-red-800">삭제</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isReplying && !isEditing && (
        <div className="pl-11 mt-2">
          <CommentForm onSubmit={handleReplySubmit} isSubmitting={isSubmitting} />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-8 mt-4 border-l-2 border-gray-100">
          <CommentList comments={comment.replies} postId={postId} onReplySubmit={onReplySubmit} isSubmitting={isSubmitting} onUpdate={onUpdate} />
        </div>
      )}
    </article>
  );
}