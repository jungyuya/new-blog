// 파일 위치: apps/frontend/src/components/PostList.tsx
'use client';

import { useEffect } from 'react';
import { motion, Variants } from 'framer-motion'; // 1. framer-motion import
import { PaginatedPosts } from '@/utils/api';
import { useInfinitePosts } from '@/hooks/useInfinitePosts';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';

const Spinner = () => (
  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
);

// 2. PostList 컨테이너를 위한 애니메이션 variants 정의
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 자식 요소들을 0.1초 간격으로 순차적으로 애니메이션
    },
  },
};

interface PostListProps {
  fallbackData: PaginatedPosts;
  initialCategory?: 'post' | 'learning';
}

export default function PostList({ fallbackData, initialCategory }: PostListProps) {
  const { posts, error, isRefreshing, isReachingEnd, loadMore, size, isLoading } = useInfinitePosts(fallbackData, initialCategory);
  const { setTarget, entry } = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0.1,
  });

  useScrollRestoration('main-scroll-position', size, !isRefreshing);

  useEffect(() => {
    if (entry?.isIntersecting && !isRefreshing && !isReachingEnd) {
      loadMore();
    }
  }, [entry, isRefreshing, isReachingEnd, loadMore]);

  if (error) return <p className="text-red-500">게시물 목록을 불러오는 데 실패했습니다.</p>;

  // [Fix] 게시물이 0개라도 다음 페이지가 있다면(isReachingEnd === false) 로딩을 계속 시도해야 합니다
  // 따라서 isReachingEnd가 true일 때만 '게시물이 없습니다'를 보여줍니다.
  if (posts.length === 0 && !isRefreshing && !isLoading && isReachingEnd) {
    return <p className="text-center text-gray-500 py-12 dark:text-gray-400">아직 작성된 게시물이 없습니다.</p>;
  }

  return (
    <>
      <motion.div
        className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy={isRefreshing}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {posts.map((post) => (
          <PostCard key={post.postId} post={post} />
        ))}
        {(isRefreshing || isLoading) && Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={`skeleton-${i}`} />)}
      </motion.div>

      <div
        ref={setTarget}
        className="flex justify-center mt-12 h-10"
        role="status"
        aria-live="polite"
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