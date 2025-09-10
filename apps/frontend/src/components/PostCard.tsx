// 파일 위치: apps/frontend/src/components/PostCard.tsx (v2.0 - 레이아웃 및 메타데이터 개선)
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

  // Link 컴포넌트가 아닌 div 등에서 라우팅이 필요할 때 사용
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 태그 링크를 클릭한 경우는 페이지 이동을 막습니다.
    if ((e.target as HTMLElement).closest('a[href^="/tags/"]')) {
      return;
    }
    router.push(`/posts/${post.postId}`);
  };

  return (
    // [수정] 카드 전체를 flex-col로 만들어 푸터를 하단에 고정하기 쉽게 합니다.
    <div
      onClick={handleCardClick}
      className="flex flex-col h-full bg-white group overflow-hidden rounded-lg shadow-lg transition-shadow duration-300 hover:shadow-2xl cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/posts/${post.postId}`); }}
    >
      {/* --- 1. 섬네일 이미지 영역 --- */}
      {post.thumbnailUrl && (
        <div className="relative w-full aspect-video">
          <Image
            src={post.thumbnailUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={true} // --- [핵심 수정] Thumbnails 이미지에 대한 Next.js 최적화 기능을 비활성화
          />
        </div>
      )}

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

        {/* 오른쪽: 메타데이터 (작성일 + 댓글 수) */}
        <div className="flex items-center space-x-2">
          <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>
          <span className="mx-1">·</span>
          <span>💬 {post.commentCount || 0}</span>
          <span className="mx-1">·</span>
          <span>👀 {post.viewCount || 0}</span>
        </div>
      </div>
    </div>
  );
}