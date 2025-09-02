// 파일 위치: apps/frontend/src/components/PostHeader.tsx
'use client';

import { Post } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { useState } from 'react';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import Link from 'next/link'; // [추가] Link 컴포넌트를 import 합니다.


// 이 컴포넌트가 받을 props 타입을 정의합니다.
interface PostHeaderProps {
  post: Post;
}

export default function PostHeader({ post }: PostHeaderProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // 현재 로그인한 사용자가 이 게시물의 소유자인지 확인하는 로직
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
      router.refresh(); // [개선] 페이지를 새로고침하여 목록 변경사항을 즉시 반영
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('게시물 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mb-8">
      {/* 제목 */}
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>

      {/* 메타 정보 (작성자, 작성일, 조회수) */}
      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6">
        <span>작성자: {post.authorNickname || post.authorEmail.split('@')[0]}</span>
        <span>|</span>
        <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
        <span>|</span>
        <span>조회수 {post.viewCount || 0}</span>
      </div>

      {/* [핵심 추가] 태그 목록 */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map(tag => (
            <Link href={`/tags/${tag}`} key={tag}>
              <span className="bg-gray-200 text-gray-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-gray-300 transition-colors">
                {tag}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* 수정/삭제 버튼 (소유자에게만 보임) */}
      {isOwner && (
        <div className="mt-6 flex space-x-4">
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

      {/* 구분선 */}
      <hr className="mt-8" />
    </div>
  );
}