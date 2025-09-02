// 파일 위치: apps/frontend/src/components/PostCard.tsx (v1.1 - 메타데이터 표시 최종본)
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation'; // [추가] 페이지 이동을 위해
import { Post } from '@/utils/api';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import { useAuth } from '@/contexts/AuthContext';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');
  const router = useRouter(); // [추가]

  const summary = (post.content ?? '')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/[#*`_~=\->|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 150) + ((post.content?.length ?? 0) > 150 ? '...' : '');

  const handleCardClick = () => {
    router.push(`/posts/${post.postId}`);
  };


  return (
    // [핵심] 최상위 요소가 <Link>에서 <div onClick={...}>로 변경되었습니다.
    // cursor-pointer 클래스를 추가하여 클릭 가능한 UI임을 시각적으로 알려줍니다.
    <div
      onClick={handleCardClick}
      className="block group overflow-hidden rounded-lg shadow-lg transition-shadow duration-300 hover:shadow-2xl cursor-pointer"
      // 키보드 탐색 사용자를 위한 접근성 속성 추가
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
    >
      <div className="flex flex-col h-full bg-white">
        {/* --- 1. 섬네일 이미지 영역 --- */}
        <div className="relative w-full aspect-video bg-gray-100">
          <Image
            // [핵심 수정] post.thumbnailUrl이 falsy(null, undefined, '')일 경우,
            // public 폴더의 기본 이미지 경로를 사용합니다.
            src={post.thumbnailUrl || '/123.webp'}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* --- 2. 콘텐츠 정보 영역 --- */}
        <div className="flex flex-col flex-1 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
          <p className="text-gray-500 text-sm flex-1 mb-4">{summary}</p>

          {/* [핵심] 태그 목록은 이제 안전하게 내부에 Link를 포함할 수 있습니다. */}
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

          {/* 메타 정보 */}
          <div className="flex items-center text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100">
            <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
            <span className="mx-2">|</span>
            <span>조회수 {post.viewCount || 0}</span>

            {/* 관리자에게만 보이는 상태 뱃지 */}
            {isAdmin && (
              <div className="ml-auto flex gap-2">
                {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs">📝 임시저장</span>}
                {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs">🔒 비밀글</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}