// apps/frontend/src/app/posts/new/page.tsx (미사용 변수 제거)
'use client';

import { useState } from 'react';
// import { useRouter } from 'next/navigation'; // 1. 미사용 import 제거

export default function NewPostPage() {
  // const router = useRouter(); // 2. 미사용 변수 제거
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // const [isLoading, setIsLoading] = useState(false); // 3. 미사용 변수 제거
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('현재 폼 제출 기능은 비활성화되어 있습니다.');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">새 글 작성</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-4">
        {/* ... 폼 내용은 동일 ... */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목</label>
          <input
            id="title"
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
          <textarea
            id="content"
            placeholder="내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm h-64"
          />
        </div>
        <button
          type="submit"
          disabled={false} // isLoading이 없으므로 false로 고정
          className="p-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          게시물 저장 (기능 비활성화)
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </main>
  );
}