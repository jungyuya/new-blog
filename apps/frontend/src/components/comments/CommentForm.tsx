// 파일 위치: apps/frontend/src/components/comments/CommentForm.tsx (v2.0 - 상태 및 핸들러 추가)
'use client';

import React, { useState } from 'react';

// [신규] 부모 컴포넌트로부터 받을 props 타입을 정의합니다.
interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>; // 댓글 내용을 받아 비동기 작업을 처리할 함수
  isSubmitting: boolean; // 현재 댓글이 제출 중인지 여부
}

export default function CommentForm({ onSubmit, isSubmitting }: CommentFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // form의 기본 제출 동작(페이지 새로고침)을 막습니다.
    if (!content.trim()) return; // 내용이 없으면 아무것도 하지 않습니다.

    await onSubmit(content);
    setContent(''); // 제출 성공 후 입력창을 비웁니다.
  };

  return (
    <form className="mt-4" onSubmit={handleSubmit}>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
        rows={3}
        placeholder="댓글을 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isSubmitting} // 제출 중일 때 입력창 비활성화
      />
      <div className="flex justify-end mt-2">
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
          disabled={isSubmitting || !content.trim()} // 제출 중이거나 내용이 없을 때 버튼 비활성화
        >
          {isSubmitting ? '등록 중...' : '댓글 등록'}
        </button>
      </div>
    </form>
  );
}