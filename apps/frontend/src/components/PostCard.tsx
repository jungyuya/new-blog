// 파일 위치: apps/frontend/src/components/PostCard.tsx (v1.4 - 닉네임 표시 최종본)
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Post } from '@/utils/api';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/posts/${post.postId}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="block group overflow-hidden rounded-lg shadow-lg transition-shadow duration-300 hover:shadow-2xl cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
    >
      <div className="flex flex-col h-full bg-white">
        {/* --- 1. 섬네일 이미지 영역 --- */}
        <div className="relative w-full aspect-video bg-gray-100">
          {post.thumbnailUrl ? (
            <Image
              src={post.thumbnailUrl}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-200">
              <span className="text-gray-500">이미지가 포함되지 않은 글 입니다.</span>
            </div>
          )}
        </div>

        {/* --- 2. 콘텐츠 정보 영역 --- */}
        <div className="flex flex-col flex-1 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
          <p className="text-gray-500 text-sm flex-1 mb-4">{post.summary || ''}</p>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map(tag => (
                <Link
                  href={`/tags/${encodeURIComponent(tag)}`}
                  key={tag}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-gray-300 transition-colors z-10 relative"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* --- 메타 정보 --- */}
          <div className="flex items-center text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100">
            {/* [핵심 수정] 작성자 정보를 authorNickname으로 표시합니다. */}
            <span className="font-semibold">{post.authorNickname || '익명'}</span>
            <span className="mx-2">·</span>
            <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
            <span className="mx-2">·</span>
            <span>조회수 {post.viewCount || 0}</span>
            
            {isAdmin && (
              <div className="ml-auto flex gap-2">
                {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs">📝임시글</span>}
                {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs">🔒</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}