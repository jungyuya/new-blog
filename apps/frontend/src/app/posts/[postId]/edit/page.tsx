// 파일 위치: apps/frontend/src/app/posts/[postId]/edit/page.tsx (v1.2 - ESLint 해결 및 로직 개선 최종본)
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Post } from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';

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
  const [initialContent, setInitialContent] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 게시물 데이터를 불러오는 함수
  const fetchPost = useCallback(async () => {
    if (!postId) {
      setIsLoading(false);
      setError('유효하지 않은 게시물 ID입니다.');
      return;
    }
    try {
      const { post: fetchedPost } = await api.fetchPostById(postId);

      // [핵심] 소유권 검증 로직 추가
      if (user && fetchedPost.authorId !== user.id) {
        alert('이 게시물을 수정할 권한이 없습니다.');
        router.replace(`/posts/${postId}`); // 수정 페이지 접근 차단
        return;
      }

      setTitle(fetchedPost.title);
      setContent(fetchedPost.content);
      setInitialContent(fetchedPost.content); // Editor 초기값을 위한 상태 설정
    } catch (err) {
      // [해결] err 변수를 console.error에서 사용하여 'no-unused-vars' 규칙을 만족시킵니다.
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
      await api.updatePost(postId, { title, content });
      alert('게시물이 성공적으로 수정되었습니다.');
      router.push(`/posts/${postId}`);
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
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">글 수정하기</h1>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
        <div>
          <label htmlFor="title" className="block text-lg font-medium text-gray-800 mb-2">제목</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm"
            required
          />
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-800 mb-2">내용</label>
          <div className="mt-1">
            {/* [핵심 수정] isLoading이 false이고, initialContent가 빈 문자열이 아닐 때만 Editor를 렌더링하도록 조건을 강화합니다. */}
            {/* 이렇게 하면 데이터가 완전히 준비된 상태에서만 Editor가 마운트되는 것을 보장할 수 있습니다. */}
            {!isLoading && initialContent && (
              <Editor
                initialValue={initialContent}
                onChange={(value) => setContent(value)}
              />
            )}
            {/* 로딩 중이거나, 아직 initialContent가 없을 때 보여줄 플레이스홀더 */}
            {(isLoading || !initialContent) && (
              <div className="w-full h-96 bg-gray-200 animate-pulse rounded-md"></div>
            )}
          </div>
        </div>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-yellow-500 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-600 disabled:bg-gray-400"
          >
            {isSubmitting ? '수정 중...' : '수정 완료'}
          </button>
        </div>
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