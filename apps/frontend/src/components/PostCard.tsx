// 파일 위치: apps/frontend/src/components/PostCard.tsx (v2.2 - 기본 썸네일 적용)
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

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a[href^="/tags/"]')) {
      return;
    }
    router.push(`/posts/${post.postId}`);
  };

  // --- [핵심 수정] 썸네일 URL을 결정하는 변수를 미리 선언합니다. ---
  const thumbnailUrl = post.thumbnailUrl || '/default-thumbnail.webp';

  return (
    <div
      onClick={handleCardClick}
      className="flex flex-col h-full bg-white group overflow-hidden rounded-lg shadow-lg transition-shadow duration-300 hover:shadow-2xl cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/posts/${post.postId}`); }}
    >
      {/* --- 1. 섬네일 이미지 영역 (로직 수정) --- */}
      <div className="relative w-full aspect-video">
        <Image
          src={thumbnailUrl} // [수정] 위에서 정의한 변수 사용
          alt={post.title}
          fill
          className="object-cover" // 이미지가 컨테이너를 꽉 채우도록 설정
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          // 기본 이미지에 대해서는 최적화를 끌 수 있습니다.
          unoptimized={!post.thumbnailUrl}
        />
      </div>

      {/* --- 2. 콘텐츠 정보 영역 (레이아웃 수정) --- */}
      <div className="flex flex-col flex-1 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
        <p className="text-gray-500 text-sm mb-4">{post.summary || ''}</p>

        {/* [수정] 태그 영역을 콘텐츠와 푸터 사이로 이동 */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto pt-4">
            {post.tags.map(tag => (
              <Link
                href={`/tags/${encodeURIComponent(tag)}`}
                key={tag}
                className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-gray-300 transition-colors z-10 relative"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* --- 3. [신규] 푸터 영역 --- */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-6 py-4 border-t border-gray-100">
        {/* 왼쪽: 작성자 정보 (아바타 + 닉네임) */}
        <div className="flex items-center space-x-2">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200">
            <Image
              src={post.authorAvatarUrl || '/default-avatar.png'}
              alt={`${post.authorNickname || '익명'}의 프로필 사진`}
              fill
              className="object-cover"
              sizes="24px"
            />
          </div>
          <span className="font-semibold">{post.authorNickname || '익명'}</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* --- [핵심 수정] 관리자일 경우에만 상태 태그를 렌더링합니다. --- */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs">📝임시글</span>}
              {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs">🔒</span>}
            </div>
          )}
          <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
          <span className="mx-1">·</span>
          <span>댓글 {post.commentCount || 0}</span>
          <span className="mx-1">·</span>
          <span>조회수 {post.viewCount || 0}</span>
        </div>
      </div>
    </div>
  );
}