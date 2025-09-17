// 파일 위치: apps/frontend/src/components/PostHeader.tsx
'use client';

import { Post } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { useState } from 'react';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import Link from 'next/link';

interface PostHeaderProps {
  post: Post;
}

export default function PostHeader({ post }: PostHeaderProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

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
      router.refresh();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('게시물 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mb-8">
      {/* [수정] 1. 제목에 다크 모드 색상 적용 */}
      <h1 className="text-4xl font-bold text-gray-900 mb-4 dark:text-gray-100">{post.title}</h1>

      {/* [수정] 2. 메타 정보 텍스트에 다크 모드 색상 적용 */}
      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6 dark:text-gray-400">
        <span className="font-semibold">{post.authorNickname || post.authorEmail.split('@')[0]}</span>
        <span>|</span>
        <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
        <span>|</span>
        <span>조회수 {post.viewCount || 0}</span>
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map(tag => (
            <Link href={`/tags/${tag}`} key={tag}>
              {/* [수정] 3. 태그에 다크 모드 스타일 적용 (PostCard와 동일) */}
              <span className="bg-gray-200 text-gray-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                {tag}
              </span>
            </Link>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="mt-6 flex space-x-4">
          {/* [수정] 4. 수정/삭제 버튼은 PostUtilButtons에서 다룰 예정이지만, 기본 스타일만 적용 */}
          <button
            onClick={() => router.push(`/posts/${post.postId}/edit`)}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 dark:bg-red-700 dark:hover:bg-red-800 dark:disabled:bg-gray-500"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      )}

      {/* [수정] 5. 구분선에 다크 모드 색상 적용 */}
      <hr className="mt-8 border-gray-200 dark:border-gray-700" />
    </div>
  );
}