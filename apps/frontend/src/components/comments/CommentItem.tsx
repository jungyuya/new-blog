// 파일 위치: apps/frontend/src/components/comments/CommentItem.tsx (v2.1 - 답글 기능 추가)
'use client';

import React, { useState } from 'react'; // [수정] useState import
import Image from 'next/image';
import { Comment } from '@/utils/api';
import CommentList from './CommentList';
import ClientOnlyLocalDate from '../ClientOnlyLocalDate';
import CommentForm from './CommentForm'; // [신규] 답글 폼을 위해 CommentForm import

interface CommentItemProps {
  comment: Comment;
  // [신규] 부모로부터 답글 제출 핸들러를 받기 위한 props 추가
  onReplySubmit: (content: string, parentCommentId: string, parentCreatedAt: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function CommentItem({ comment, onReplySubmit, isSubmitting }: CommentItemProps) {
  // [신규] 답글 폼을 보여줄지 여부를 관리하는 상태
  const [isReplying, setIsReplying] = useState(false);

  const handleReplySubmit = async (content: string) => {
    // 부모로부터 받은 onReplySubmit 함수에 필요한 모든 정보를 담아 호출
    await onReplySubmit(content, comment.commentId, comment.createdAt);
    setIsReplying(false); // 답글 제출 성공 후 폼을 닫습니다.
  };

  return (
    <article className="py-4 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start mb-2">
        <div className="relative flex-shrink-0 w-8 h-8 mr-3">
          {/* ... (Image 컴포넌트는 변경 없음) ... */}
          <Image
            src={comment.authorAvatarUrl || '/default-avatar.png'}
            alt={`${comment.authorNickname}의 프로필 사진`}
            fill
            className="object-cover rounded-full"
            sizes="32px"
          />
        </div>
        <div className="flex-grow">
          <div className="flex items-center">
            <span className="font-bold text-gray-800">{comment.authorNickname}</span>
            <span className="mx-2 text-gray-400">·</span>
            <ClientOnlyLocalDate dateString={comment.createdAt} />
          </div>
          {comment.isDeleted ? (
            <p className="text-gray-500 italic">{comment.content}</p>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
          )}
          <div className="flex items-center mt-2 text-sm space-x-4">
            {!comment.isDeleted && (
              // [수정] 버튼 클릭 시 isReplying 상태를 토글합니다.
              <button 
                onClick={() => setIsReplying(!isReplying)} 
                className="text-gray-600 hover:text-gray-800"
              >
                {isReplying ? '취소' : '답글 달기'}
              </button>
            )}
            {/* 여기에 나중에 수정/삭제 버튼이 추가될 것입니다. */}
          </div>
        </div>
      </div>

      {/* --- [신규] 답글 폼 조건부 렌더링 --- */}
      {isReplying && (
        <div className="pl-11 mt-2">
          <CommentForm onSubmit={handleReplySubmit} isSubmitting={isSubmitting} />
        </div>
      )}

      {/* --- 재귀 렌더링 부분 (변경 없음) --- */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-8 mt-4 border-l-2 border-gray-100">
          {/* [수정] 자식에게도 props를 그대로 전달(prop drilling)합니다. */}
          <CommentList 
            comments={comment.replies} 
            onReplySubmit={onReplySubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </article>
  );
}