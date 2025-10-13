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
}

export default function PostList({ fallbackData }: PostListProps) {
  const { posts, error, isRefreshing, isReachingEnd, loadMore, size } = useInfinitePosts(fallbackData);
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

  if (posts.length === 0 && !isRefreshing) {
    return <p>아직 작성된 게시물이 없습니다.</p>;
  }

  return (
    <>
      {/* 3. grid div를 motion.div로 변경하고 variants 및 애니메이션 prop 추가 */}
      <motion.div
        className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy={isRefreshing}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {posts.map((post) => (
          // PostCard는 이미 motion.div로 되어 있으며, 부모의 variants를 상속받아 애니메이션됨
          <PostCard key={post.postId} post={post} />
        ))}
        {isRefreshing && Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={`skeleton-${i}`} />)}
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