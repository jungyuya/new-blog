// 파일 위치: apps/frontend/src/components/comments/CommentForm.tsx (v2.1 - 수정 모드 지원)
'use client';

import React, { useState, useEffect } from 'react'; // [수정] useEffect import

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  isSubmitting: boolean;
  initialContent?: string; // [신규] 수정 시 초기 내용을 받기 위한 prop
}

export default function CommentForm({ onSubmit, isSubmitting, initialContent = '' }: CommentFormProps) {
  const [content, setContent] = useState(initialContent);

  // [신규] 수정 모드 취소 시 내용을 원래대로 되돌리기 위한 로직
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content);
    // [수정] 수정 모드가 아닐 때만 입력창을 비웁니다.
    if (!initialContent) {
      setContent('');
    }
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