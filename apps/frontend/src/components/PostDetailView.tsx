// 파일 위치: apps/frontend/src/components/PostDetailView.tsx
// 역할: 단일 게시물의 내용을 보여주고, 소유권에 따라 수정/삭제 버튼을 렌더링.

'use client';

import { Post } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { useState } from 'react';

interface PostDetailViewProps {
  post: Post | null;
}

export default function PostDetailView({ post }: PostDetailViewProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!post) {
    return <div>게시물을 찾을 수 없습니다.</div>;
  }

  // [핵심] '인가(Authorization)' 로직
  // 인증 로딩이 끝나고, 로그인한 사용자가 존재하며, 그 사용자의 ID가 게시물의 작성자 ID와 일치하는지 확인합니다.
  const isOwner = !isAuthLoading && user && user.id === post.authorId;

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.deletePost(post.postId);
      alert('게시물이 삭제되었습니다.');
      router.push('/'); // 삭제 후 홈페이지로 이동
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
        <span>작성일: {new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      
      {/* --- [핵심] isOwner가 true일 때만 이 버튼들을 렌더링합니다. --- */}
      {isOwner && (
        <div className="flex space-x-4 mb-8">
          {/* --- [핵심 수정] --- */}
          {/* onClick 핸들러가 router.push를 호출하여, '.../edit' 경로로 페이지를 이동시킵니다. */}
          <button 
            onClick={() => router.push(`/posts/${post.postId}/edit`)}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600"
          >
            수정
          </button>
          {/* --- [수정 완료] --- */}

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      )}

      {/* 게시물 내용을 마크다운으로 렌더링하려면 별도 라이브러리가 필요합니다. 지금은 텍스트로 표시합니다. */}
      <p className="whitespace-pre-wrap">{post.content}</p>
    </article>
  );
}