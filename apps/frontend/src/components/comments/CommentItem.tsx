// 파일 위치: apps/frontend/src/components/comments/CommentItem.tsx (v2.3 - 답글 접기/펴기 기능 추가)
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Comment, api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import CommentList from './CommentList';
import ClientOnlyLocalDate from '../ClientOnlyLocalDate';
import CommentForm from './CommentForm';
import type { KeyedMutator } from 'swr';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onReplySubmit: (content: string, parentCommentId: string, parentCreatedAt: string) => Promise<void>;
  isSubmitting: boolean;
  onUpdate: KeyedMutator<Comment[]>; 
}

export default function CommentItem({ comment, postId, onReplySubmit, isSubmitting, onUpdate }: CommentItemProps) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // --- [신규] 답글 목록 표시 상태 추가 ---
  const [isRepliesVisible, setIsRepliesVisible] = useState(false);

  const isOwner = user?.id === comment.authorId;

  const handleReplySubmit = async (content: string) => {
    await onReplySubmit(content, comment.commentId, comment.createdAt);
    setIsReplying(false);
  };

  const handleUpdateSubmit = async (content: string) => {
    if (!isOwner) return;
    try {
      await api.updateComment(comment.commentId, { content, postId });
      await onUpdate();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment:', err);
      alert('댓글 수정에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    if (window.confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
      try {
        await api.deleteComment(comment.commentId, { postId });
        await onUpdate();
      } catch (err) {
        console.error('Failed to delete comment:', err);
        alert('댓글 삭제에 실패했습니다.');
      }
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <article className="py-4 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start mb-2">
        <div className="relative flex-shrink-0 w-8 h-8 mr-3">
          <Image src={comment.authorAvatarUrl || '/default-avatar.png'} alt={`${comment.authorNickname}의 프로필 사진`} fill className="object-cover rounded-full" sizes="32px" />
        </div>
        <div className="flex-grow">
          <div className="flex items-center">
            <span className="font-bold text-gray-800">{comment.authorNickname}</span>
            <span className="mx-2 text-gray-400">·</span>
            <ClientOnlyLocalDate dateString={comment.createdAt} />
          </div>
          
          {isEditing ? (
            <CommentForm onSubmit={handleUpdateSubmit} isSubmitting={isSubmitting} initialContent={comment.content} />
          ) : (
            comment.isDeleted ? (
              <p className="text-gray-500 italic mt-2">{comment.content}</p>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap mt-2">{comment.content}</p>
            )
          )}

          {/* --- [핵심 수정] 버튼 컨테이너를 justify-between으로 변경하고, 그룹을 나눔 --- */}
          <div className="flex items-center justify-between mt-2">
            {/* 왼쪽 버튼 그룹 */}
            <div className="flex items-center space-x-4">
              {!isEditing && !comment.isDeleted && (
                <>
                  <button onClick={() => setIsReplying(!isReplying)} className="text-sm text-gray-600 hover:text-gray-800">
                    {isReplying ? '취소' : '답글 달기'}
                  </button>
                  {isOwner && (
                    <>
                      <button onClick={() => setIsEditing(true)} className="text-sm text-gray-600 hover:text-gray-800">수정</button>
                      <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800">삭제</button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* 오른쪽 버튼 그룹 */}
            <div>
              {hasReplies && (
                <button
                  onClick={() => setIsRepliesVisible(!isRepliesVisible)}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <svg className={`w-4 h-4 mr-1 transition-transform duration-200 ${isRepliesVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  {isRepliesVisible ? '숨기기' : `답글 ${comment.replies.length}개`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isReplying && !isEditing && (
        <div className="pl-11 mt-2">
          <CommentForm onSubmit={handleReplySubmit} isSubmitting={isSubmitting} />
        </div>
      )}

      {isRepliesVisible && hasReplies && (
        <div className="pl-8 mt-2 border-l-2 border-gray-100">
          <CommentList comments={comment.replies} postId={postId} onReplySubmit={onReplySubmit} isSubmitting={isSubmitting} onUpdate={onUpdate} />
        </div>
      )}
    </article>
  );
}