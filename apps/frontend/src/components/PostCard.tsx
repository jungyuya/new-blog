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
          unoptimized={true}
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

      {/* --- 3. [수정] 푸터 영역 (가독성 개선을 위해 2줄 구조로 변경) --- */}
      <div className="px-6 py-4 border-t border-gray-100">
        {/* 첫째 줄: 작성자 정보와 관리자 태그 */}
        <div className="flex items-center justify-between">
          {/* 왼쪽: 작성자 정보 (아바타 + 닉네임) */}
          <div className="flex items-center space-x-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
              <Image
                src={post.authorAvatarUrl || '/default-avatar.png'}
                alt={`${post.authorNickname || '익명'}의 프로필 사진`}
                fill
                className="object-cover"
                sizes="32px"
                unoptimized={true}
              />
            </div>
            <span className="text-sm font-semibold text-gray-800">{post.authorNickname || '익명'}</span>
          </div>

          {/* [핵심 이동] 오른쪽: 관리자일 경우에만 상태 태그를 렌더링 */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs">📝임시글</span>}
              {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs">🔒</span>}
            </div>
          )}
        </div>

        {/* 둘째 줄: 게시물 통계 정보 */}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
          {/* 왼쪽: 날짜 */}
          <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>

          {/* 오른쪽: 댓글, 좋아요, 조회수 */}
          <div className="flex items-center space-x-2">
            <span>💬 {post.commentCount || 0}</span>
            <span className="mx-1">·</span>
            <span>💕 {post.likeCount || 0}</span>
            <span className="mx-1">·</span>
            <span>👀 {post.viewCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}