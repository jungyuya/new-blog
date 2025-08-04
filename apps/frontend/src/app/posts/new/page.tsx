// apps/frontend/src/app/posts/new/page.tsx (최종 완성본)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthenticator } from '@aws-amplify/ui-react';
import AuthLayout from '@/components/AuthLayout';
import { createNewPost } from '@/utils/api';

// 실제 UI와 로직을 담당하는 내부 컴포넌트
function NewPostForm() {
  const router = useRouter();
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useEffect를 사용하여 인증 상태를 감시하고, 비로그인 사용자를 리다이렉트합니다.
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/'); // 로그인하지 않았으면 메인 페이지로 보냅니다.
    }
  }, [authStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      setError('제목과 내용은 필수 항목입니다.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      await createNewPost(title, content);
      // 성공 시 메인 페이지로 이동하여 사용자가 방금 작성한 글을 볼 수 있도록 합니다.
      router.push('/');
    } catch (err) {
      setError('게시물을 생성하는 데 실패했습니다. 다시 시도해주세요.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 아직 인증 상태 확인 중이거나, 리다이렉트 되기 전에는 로딩 상태를 보여줍니다.
  if (authStatus !== 'authenticated') {
    return <div>로딩 중...</div>;
  }

  // ⭐ [누락된 부분 복원] 인증된 사용자에게 실제 폼 UI를 렌더링합니다.
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
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
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
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 h-64"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="p-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '저장 중...' : '게시물 저장'}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </main>
  );
}

// 페이지의 진입점 역할을 하는 최종 export 컴포넌트
export default function NewPostPage() {
  return (
    <AuthLayout>
      <NewPostForm />
    </AuthLayout>
  );
}