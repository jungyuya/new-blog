// 파일 위치: apps/frontend/src/components/PostCard.tsx (v1.1 - 메타데이터 표시 최종본)
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Post } from '@/utils/api';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import { useAuth } from '@/contexts/AuthContext'; // [추가] 관리자 여부 확인을 위해

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth(); // [추가]
  const isAdmin = user?.groups?.includes('Admins'); // [추가]

  const summary = post.content?.replace(/<[^>]*>?/gm, '').substring(0, 50) + (post.content?.length > 150 ? '...' : '');

  return (
    <Link href={`/posts/${post.postId}`} className="block group overflow-hidden rounded-lg shadow-lg transition-shadow duration-300 hover:shadow-2xl">
      <div className="flex flex-col h-full bg-white">
        {/* --- 섬네일 이미지 영역 --- */}
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
              <span className="text-gray-500">No Image</span>
            </div>
          )}
        </div>

        {/* --- 콘텐츠 정보 영역 --- */}
        <div className="flex flex-col flex-1 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
          <p className="text-gray-600 text-sm flex-1 mb-4">{summary}</p>
          
          {/* [수정] 태그 목록 렌더링 */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map(tag => (
                <span key={tag} className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 메타 정보 */}
          <div className="flex items-center text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100">
            <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
            <span className="mx-2">·</span>
            <span>조회수 {post.viewCount || 0}</span>
            
            {/* [핵심 추가] 관리자에게만 보이는 상태 뱃지 */}
            {isAdmin && (
              <div className="ml-auto flex gap-2">
                {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs">📝 임시저장</span>}
                {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs">🔒 비밀글</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}