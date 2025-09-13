// 파일 위치: apps/frontend/src/app/posts/[postId]/edit/page.tsx (v1.2 - ESLint 해결 및 로직 개선 최종본)
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import PostMetadataEditor, { type PostMetadata } from '@/components/PostMetadataEditor';

// Editor 컴포넌트를 동적으로 import 합니다.
const Editor = dynamic(() => import('@/components/Editor'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 animate-pulse rounded-md"></div>,
});

// 실제 폼 로직을 담고 있는 컴포넌트
function EditPostForm() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  // URL 파라미터에서 postId를 안전하게 추출합니다.
  const postId = typeof params.postId === 'string' ? params.postId : undefined;

  // 상태 관리
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<PostMetadata>({
    tags: [],
    status: 'published',
    visibility: 'public',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMetadataChange = useCallback((newMetadata: PostMetadata) => {
    setMetadata(newMetadata);
  }, []);

  // 게시물 데이터를 불러오는 함수
  const fetchPost = useCallback(async () => {
    if (!postId) {
      setIsLoading(false);
      setError('유효하지 않은 게시물 ID입니다.');
      return;
    }
    try {
      const { post: fetchedPost } = await api.fetchPostById(postId);

      if (user && fetchedPost.authorId !== user.id) {
        alert('이 게시물을 수정할 권한이 없습니다.');
        router.replace(`/posts/${postId}`);
        return;
      }

      // [핵심 수정] 불러온 데이터로 모든 상태를 올바르게 초기화합니다.
      setTitle(fetchedPost.title);
      setContent(fetchedPost.content ?? '');
      // PostMetadataEditor가 사용할 초기 데이터를 설정합니다.
      setMetadata({
        tags: fetchedPost.tags || [],
        status: fetchedPost.status || 'published',
        visibility: fetchedPost.visibility || 'public',
      });

    } catch (err) {
      console.error('게시물 로딩 실패:', err);
      setError('게시물을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [postId, user, router]);

  // 컴포넌트 마운트 시 게시물 데이터를 불러옵니다.
  useEffect(() => {
    // user 정보가 로드된 후에 fetchPost를 호출하여 소유권 검증을 정확하게 합니다.
    if (user) {
      fetchPost();
    }
  }, [user, fetchPost]);

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) {
      setError('게시물 ID가 없어 수정을 진행할 수 없습니다.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // [수정] 수정된 메타데이터도 함께 전송합니다.
      await api.updatePost(postId!, {
        title,
        content,
        tags: metadata.tags,
        status: metadata.status,
        visibility: metadata.visibility,
      });
      alert('게시물이 성공적으로 수정되었습니다.');
      router.push(`/posts/${postId!}`);
    } catch (err) {
      // [해결] err 변수를 console.error에서 사용하여 'no-unused-vars' 규칙을 만족시킵니다.
      console.error('게시물 수정 실패:', err);
      setError('게시물 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>게시물 정보를 불러오는 중...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-8">{error}</div>;
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">글 수정하기</h1>
      <form onSubmit={handleSubmit}>
        {/* --- 1. 제목 입력 영역 --- */}
        <div className="mb-8">
          <label htmlFor="title" className="sr-only">제목</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-4xl font-bold p-3 border-b-2 border-gray-200 focus:outline-none focus:border-indigo-500 transition-colors bg-transparent"
            required
          />
        </div>

        {/* --- 2. 본문 에디터 영역 --- */}
        <div className="mb-8">
          <label htmlFor="content" className="sr-only">내용</label>
          {/* [수정] 데이터 로딩이 완료된 후에만 Editor를 렌더링합니다. */}
          {!isLoading && (
            <Editor
              initialValue={content}
              onChange={(value) => setContent(value)}
            />
          )}
        </div>

        {/* --- 3. 메타데이터 설정 영역 --- */}
        <div className="mb-8">
          <PostMetadataEditor
            initialData={metadata}
            onMetadataChange={handleMetadataChange}
          />
        </div>

        {/* 에러 메시지 표시 영역 */}
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* --- 4. 하단 고정 버튼 영역 --- */}
        <footer className="sticky bottom-0 left-0 w-full bg-white bg-opacity-90 backdrop-blur-sm p-4 mt-8 border-t">
          <div className="container mx-auto flex justify-end max-w-4xl px-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-yellow-500 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-600 disabled:bg-gray-400"
            >
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}

// 페이지 진입점 컴포넌트
export default function EditPostPage() {
  return (
    <ProtectedRoute>
      <EditPostForm />
    </ProtectedRoute>
  );
}