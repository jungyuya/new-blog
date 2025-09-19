// 파일 위치: apps/frontend/src/components/PostList.tsx (v1.2 - ARIA 속성 추가)
'use client';

import { useEffect } from 'react';
import { PaginatedPosts } from '@/utils/api';
import { useInfinitePosts } from '@/hooks/useInfinitePosts';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';

const Spinner = () => (
  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
);

interface PostListProps {
  fallbackData: PaginatedPosts;
  excludeIds?: string[]; // [추가] 제외할 게시물 ID 배열
}

export default function PostList({ fallbackData, excludeIds = [] }: PostListProps) {
  const { posts, error, isRefreshing, isReachingEnd, loadMore, size } = useInfinitePosts(fallbackData, excludeIds);
  const { setTarget, entry } = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0.1,
  });

  // 데이터 로딩이 완료되었을 때(!isRefreshing)만 복원을 활성화합니다.
  useScrollRestoration('main-scroll-position', size, !isRefreshing);

  useEffect(() => {
    if (entry?.isIntersecting && !isRefreshing && !isReachingEnd) {
      loadMore();
    }
  }, [entry, isRefreshing, isReachingEnd, loadMore]);


  if (error) return <p className="text-red-500">게시물 목록을 불러오는 데 실패했습니다.</p>;

  if (posts.length === 0 && !isRefreshing) {
    return <p>아직 작성된 게시물이 없습니다.</p>;
  }

  return (
    <>
      {/* --- 게시물 목록 그리드에 aria-busy 속성 추가 --- */}
      <div
        className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy={isRefreshing} // 로딩 중일 때 이 영역이 바쁘다고 스크린 리더에 알림
      >
        {posts.map((post) => (
          <PostCard key={post.postId} post={post} />
        ))}
        {isRefreshing && Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={`skeleton-${i}`} />)}
      </div>

      <div
        ref={setTarget}
        className="flex justify-center mt-12 h-10"
        // 스크린 리더가 이 영역의 변화를 감지하고 사용자에게 "상태 변경"을 알리도록 함
        role="status"
        aria-live="polite" // 변경 사항을 부드럽게 알림 (polite)
      >
        {!isReachingEnd && isRefreshing && (
          <>
            <Spinner />
            <span className="sr-only">게시물을 불러오는 중</span>
          </>
        )}
      </div>
    </>
  );
}