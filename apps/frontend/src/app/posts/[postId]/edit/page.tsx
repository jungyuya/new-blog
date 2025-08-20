// 파일 위치: apps/frontend/src/app/posts/[postId]/edit/page.tsx (v1.1 - Editor 적용 최종본)
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Post } from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic'; // [추가]

// [추가] Editor 컴포넌트를 동적으로 import 합니다.
const Editor = dynamic(() => import('@/components/Editor'), {
  ssr: false,
  loading: () => <p>에디터를 불러오는 중...</p>,
});

function EditPostForm() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const postId = typeof params.postId === 'string' ? params.postId : undefined;

  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) { /* ... */ return; }
    const fetchPost = async () => {
      try {
        const { post: fetchedPost } = await api.fetchPostById(postId);
        if (fetchedPost) {
          // [핵심] 데이터를 불러온 후, title과 content 상태를 설정합니다.
          setPost(fetchedPost);
          setTitle(fetchedPost.title);
          setContent(fetchedPost.content);
        } else { setError('게시물을 찾을 수 없습니다.'); }
      } catch (err) { setError('게시물을 불러오는 데 실패했습니다.'); } 
      finally { setIsLoading(false); }
    };
    fetchPost();
  }, [postId]);

  useEffect(() => { /* ... (소유권 검사 로직은 그대로) ... */ }, [isLoading, post, user, postId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) { /* ... */ return; }
    setIsSubmitting(true);
    setError(null);
    try {
      // [핵심] 수정된 title과 content 상태를 API로 전송합니다.
      await api.updatePost(postId, { title, content });
      alert('게시물이 성공적으로 수정되었습니다.');
      router.push(`/posts/${postId}`);
    } catch (err) { setError('게시물 수정에 실패했습니다.'); } 
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div>게시물 정보를 불러오는 중...</div>;
  if (error && !post) return <div className="text-red-500">{error}</div>;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">글 수정하기</h1>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
        <div>
          <label htmlFor="title" className="block text-lg font-medium text-gray-800 mb-2">제목</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label htmlFor="content" className="block text-lg font-medium text-gray-800 mb-2">내용</label>
          <div className="mt-1">
            {/* [핵심 교체] textarea를 Editor 컴포넌트로 교체합니다. */}
            {/* content가 있을 때만 Editor를 렌더링하여 초기값 문제를 방지합니다. */}
            {content !== '' && (
              <Editor
                initialValue={content}
                onChange={(value) => setContent(value)}
              />
            )}
          </div>
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

export default function EditPostPage() {
  return (
    <ProtectedRoute>
      <EditPostForm />
    </ProtectedRoute>
  );
}