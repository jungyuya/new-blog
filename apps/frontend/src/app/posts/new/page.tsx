// 파일 위치: apps/frontend/src/app/posts/new/page.tsx (v1.1 - Editor 적용 최종본)
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/utils/api';
import dynamic from 'next/dynamic';
import PostMetadataEditor, { type PostMetadata } from '@/components/PostMetadataEditor';



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
  const [content, setContent] = useState('');
  // [추가] 메타데이터를 위한 새로운 상태 변수
  const [metadata, setMetadata] = useState<PostMetadata>({
    tags: [],
    status: 'published',
    visibility: 'public',
  });
  // [추가] PostMetadataEditor로부터 변경 사항을 받을 콜백 함수
  const handleMetadataChange = useCallback((newMetadata: PostMetadata) => {
    setMetadata(newMetadata);
  }, []);
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
      // [핵심] title, content와 함께 metadata 상태를 API 호출에 포함시킵니다.
      const newPostData = {
        title,
        content,
        tags: metadata.tags,
        status: metadata.status,
        visibility: metadata.visibility,
      };

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
    // [수정] 전체적인 레이아웃을 중앙 정렬된 단일 컬럼으로 변경합니다.
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <label htmlFor="title" className="sr-only">제목</label>
          {/* [수정] 1. 제목 입력창에 다크 모드 스타일 적용 */}
          <input
            id="title"
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-4xl font-bold p-3 border-b-2 border-gray-200 focus:outline-none focus:border-indigo-200 transition-colors bg-transparent dark:text-gray-100 dark:border-gray-700 dark:focus:border-indigo-500 dark:placeholder-gray-500"
            required
          />
        </div>

        {/* --- 2. 본문 에디터 영역 --- */}
        <div className="mb-8">
          <label htmlFor="content" className="sr-only">내용</label>
          <Editor
            initialValue={content}
            onChange={(value) => setContent(value)}
          />
        </div>

        {/* --- 3. 메타데이터 설정 영역 --- */}
        <div className="mb-8">
          <PostMetadataEditor
            initialData={metadata}
            onMetadataChange={handleMetadataChange}
          />
        </div>

        {/* 에러 메시지 표시 영역 */}
        {error && <p className="text-red-500 text-center mb-4 dark:text-red-400">{error}</p>}

        {/* --- 4. 하단 고정 버튼 영역 --- */}
        <footer className="sticky bottom-0 left-0 w-full bg-white/80 backdrop-blur-sm p-4 mt-8 border-t border-gray-200 dark:bg-stone-950/80 dark:border-gray-800">
          <div className="container mx-auto flex justify-end max-w-4xl px-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {isLoading ? '저장 중...' : '글 저장하기'}
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}