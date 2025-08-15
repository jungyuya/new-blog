// 파일 위치: apps/frontend/src/app/posts/[postId]/edit/page.tsx (Step 1 최종)
// 역할: 특정 게시물을 수정하는 페이지. 기존 데이터를 불러와 폼에 채워줍니다.

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Post } from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// [개선] 실제 폼 로직을 별도의 컴포넌트로 분리합니다.
function EditPostForm() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  // [오류 해결 1] params.postId가 string | string[] | undefined 타입이므로, string 타입으로 명확하게 변환합니다.
  const postId = typeof params.postId === 'string' ? params.postId : undefined;

  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // [오류 해결 2] postId가 유효한 string이 아닐 경우, API 호출을 시도하지 않습니다.
    if (!postId) {
      setIsLoading(false);
      setError('유효하지 않은 게시물 ID입니다.');
      return;
    }

    const fetchPost = async () => {
      try {
        const { post: fetchedPost } = await api.fetchPostById(postId);
        if (fetchedPost) {
          setPost(fetchedPost);
          setTitle(fetchedPost.title);
          setContent(fetchedPost.content);
        } else {
          setError('게시물을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('게시물을 불러오는 데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  useEffect(() => {
    if (!isLoading && post && user?.id !== post.authorId) {
      alert('수정 권한이 없습니다.');
      router.push(`/posts/${postId}`);
    }
  }, [isLoading, post, user, postId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // [오류 해결 3] postId가 없을 경우, 제출 자체를 막습니다.
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
      setError('게시물 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div>게시물 정보를 불러오는 중...</div>;
  if (error && !post) return <div className="text-red-500">{error}</div>;

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">글 수정하기</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">제목</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">내용</label>
          <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm h-64" />
        </div>
        <button type="submit" disabled={isSubmitting}
          className="p-3 bg-yellow-500 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-600 disabled:bg-gray-400">
          {isSubmitting ? '수정 중...' : '수정 완료'}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </main>
  );
}

// 페이지 진입점은 변경 없습니다.
export default function EditPostPage() {
  return (
    <ProtectedRoute>
      <EditPostForm />
    </ProtectedRoute>
  );
}