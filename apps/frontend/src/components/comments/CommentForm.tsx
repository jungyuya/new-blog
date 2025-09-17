// 파일 위치: apps/frontend/src/components/comments/CommentForm.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  isSubmitting: boolean;
  initialContent?: string;
}

export default function CommentForm({ onSubmit, isSubmitting, initialContent = '' }: CommentFormProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content);
    if (!initialContent) {
      setContent('');
    }
  };

  return (
    <form className="mt-4" onSubmit={handleSubmit}>
      {/* [수정] 1. textarea에 다크 모드 스타일 적용 */}
      <textarea
        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100 dark:bg-stone-700 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:disabled:bg-gray-800"
        rows={3}
        placeholder="댓글을 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isSubmitting}
      />
      <div className="flex justify-end mt-2">
        {/* [수정] 2. 버튼에 다크 모드 스타일 적용 (주로 비활성화 상태) */}
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-800 dark:disabled:text-gray-400"
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? '등록 중...' : '댓글 등록'}
        </button>
      </div>
    </form>
  );
}