// 파일 위치: apps/frontend/src/app/posts/new/page.tsx (최종 활성화 버전)
// 역할: ProtectedRoute로 보호되며, 실제 게시물 생성 API를 호출하는 최종 폼 페이지

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/utils/api';

export default function NewPostPage() {
  return (
    <ProtectedRoute>
      <NewPostForm />
    </ProtectedRoute>
  );
}

function NewPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // [핵심] 실제 api.createNewPost 함수를 호출합니다.
      const newPostData = { title, content };
      const result = await api.createNewPost(newPostData);

      console.log('Post created successfully:', result);
      
      // [개선] 성공 시, 생성된 게시물의 상세 페이지로 이동시켜 사용자에게 즉각적인 피드백을 줍니다.
      router.push(`/posts/${result.post.postId}`);

    } catch (err) {
      console.error('Failed to create post:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('게시물 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">새 글 작성</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목</label>
          <input
            id="title"
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
            required
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
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="p-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? '저장 중...' : '게시물 저장'}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </main>
  );
}