// 파일 위치: apps/frontend/src/components/PostCard.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Post } from '@/utils/api';
import ClientOnlyLocalDate from './ClientOnlyLocalDate';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// [수정] 1. isEditorPick prop을 추가합니다.
interface PostCardProps {
  post: Post;
  isEditorPick?: boolean; // 선택적 prop으로 추가
}

// [수정] 2. props에서 isEditorPick을 받습니다.
export default function PostCard({ post, isEditorPick = false }: PostCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a[href^="/tags/"]')) {
      return;
    }
    router.push(`/posts/${post.postId}`);
  };

  const thumbnailUrl = post.thumbnailUrl || '/default-thumbnail.webp';

  return (
    <div
      onClick={handleCardClick}
      className="flex flex-col h-full bg-white group overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-2xl cursor-pointer dark:bg-stone-700 dark:shadow-none dark:border dark:border-gray-800 dark:hover:border-gray-600 dark:hover:bg-stone-600"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/posts/${post.postId}`); }}
    >
      {/* [수정] 3. 이미지 영역에 relative 클래스를 추가하고, 배지를 조건부 렌더링합니다. */}
      <div className="relative w-full aspect-video">
        <Image
          src={thumbnailUrl}
          alt={post.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          unoptimized={true}
        />
        {isEditorPick && (
          <div className="absolute top-2 right-2 bg-indigo-600/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Editor Pick
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-6">
        {/* [수정] 2. 제목과 요약 텍스트에 다크 모드 색상 적용 */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-500 transition-colors dark:text-stone-50 dark:group-hover:text-indigo-400">{post.title}</h3>
        <p className="text-stone-500 text-sm mb-4 dark:text-stone-300">{post.summary || ''}</p>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto pt-4">
            {post.tags.map(tag => (
              <Link
                href={`/tags/${encodeURIComponent(tag)}`}
                key={tag}
                // [수정] 3. 태그에 다크 모드 스타일(배경, 텍스트, hover 효과) 적용
                className="bg-gray-200 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-gray-300 transition-colors z-10 relative dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* [수정] 4. 푸터 영역의 상단 테두리에 다크 모드 색상 적용 */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-stone-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src={post.authorAvatarUrl || '/default-avatar.png'}
                alt={`${post.authorNickname || '익명'}의 프로필 사진`}
                fill
                className="object-cover"
                sizes="32px"
                unoptimized={true}
              />
            </div>
            {/* [수정] 5. 작성자 닉네임에 다크 모드 색상 적용 */}
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{post.authorNickname || '익명'}</span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {/* [수정] 6. 상태 태그에 다크 모드 스타일 적용 */}
              {post.status === 'draft' && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-md text-xs dark:bg-gray-900 dark:text-yellow-400">📝임시글</span>}
              {post.visibility === 'private' && <span className="bg-gray-400 text-white px-2 py-0.5 rounded-md text-xs dark:bg-gray-600 dark:text-gray-200">🔒</span>}
            </div>
          )}
        </div>

        {/* [수정] 7. 게시물 통계 텍스트에 다크 모드 색상 적용 */}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-3 dark:text-gray-400">
          <span><ClientOnlyLocalDate dateString={post.createdAt} /></span>

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