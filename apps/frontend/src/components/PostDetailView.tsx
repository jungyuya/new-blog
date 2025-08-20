// 파일 위치: apps/frontend/src/components/PostDetailView.tsx
// 버전: v1.1 - 날짜 처리 로직을 ClientOnlyLocalDate 컴포넌트로 리팩토링

'use client';

import { Post } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { useState } from 'react'; // useEffect는 더 이상 필요하지 않습니다.
import MarkdownViewer from './MarkdownViewer';
import ClientOnlyLocalDate from './ClientOnlyLocalDate'; // [핵심] 재사용 컴포넌트 import

interface PostDetailViewProps {
  post: Post | null;
}

export default function PostDetailView({ post }: PostDetailViewProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // [삭제] 이 컴포넌트 내의 useState와 useEffect를 사용한 날짜 포맷팅 로직은
  // ClientOnlyLocalDate 컴포넌트로 이전되었으므로 모두 삭제합니다.

  if (!post) {
    return <div>게시물을 찾을 수 없습니다.</div>;
  }

  const isOwner = !isAuthLoading && user && user.id === post.authorId;

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.deletePost(post.postId);
      alert('게시물이 삭제되었습니다.');
      router.push('/');
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('게시물 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className="prose lg:prose-xl max-w-none">
      <h1 className="mb-4">{post.title}</h1>
      <div className="text-sm text-gray-500 mb-8">
        <span>작성자: {post.authorEmail}</span> |
        {/* [핵심 수정] ClientOnlyLocalDate 컴포넌트를 사용하여 날짜를 렌더링합니다. */}
        <span> 작성일: <ClientOnlyLocalDate dateString={post.createdAt} /></span>
      </div>

      {isOwner && (
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => router.push(`/posts/${post.postId}/edit`)}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      )}

      {/* MarkdownViewer를 사용하여 게시물 본문을 렌더링합니다. */}
      {post.content && <MarkdownViewer content={post.content} />}
    </article>
  );
}