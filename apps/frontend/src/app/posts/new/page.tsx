// 파일 위치: apps/frontend/src/app/posts/new/page.tsx (v1.1 - Editor 적용 최종본)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/utils/api';
import dynamic from 'next/dynamic'; // [추가]

// [추가] Editor 컴포넌트를 동적으로 import 합니다.
const Editor = dynamic(() => import('@/components/Editor'), {
  ssr: false, // 서버에서는 렌더링하지 않습니다.
  loading: () => <p>에디터를 불러오는 중...</p>,
});

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
  // [수정] content 상태는 Editor의 initialValue로 사용됩니다.
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // [추가] 제목과 내용 유효성 검사를 강화합니다.
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const newPostData = { title, content };
      const result = await api.createNewPost(newPostData);
      console.log('Post created successfully:', result);
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
    // [수정] 레이아웃을 조금 더 깔끔하게 조정합니다.
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">새 글 작성</h1>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
        <div>
          <label htmlFor="title" className="block text-lg font-medium text-gray-800 mb-2">제목</label>
          <input
            id="title"
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-lg font-medium text-gray-800 mb-2">내용</label>
          {/* [핵심 교체] textarea를 Editor 컴포넌트로 교체합니다. */}
          <div className="mt-1">
            <Editor
              initialValue={content}
              // Editor의 내용이 변경될 때마다 content 상태를 업데이트합니다.
              onChange={(value) => setContent(value)}
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {isLoading ? '저장 중...' : '게시물 저장'}
          </button>
        </div>
      </form>
    </main>
  );
}