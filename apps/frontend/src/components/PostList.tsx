// 파일 위치: apps/frontend/src/components/PostList.tsx (v1.1 - 무한 스크롤 적용)
'use client';

import { useEffect, useRef } from 'react'; // [신규] useEffect와 useRef import
import { PaginatedPosts } from '@/utils/api';
import { useInfinitePosts } from '@/hooks/useInfinitePosts';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'; // [신규] useIntersectionObserver 훅 import
import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';

// [신규] 로딩 스피너 컴포넌트
const Spinner = () => (
  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
);

interface PostListProps {
  fallbackData: PaginatedPosts;
}

export default function PostList({ fallbackData }: PostListProps) {
  const { posts, error, isRefreshing, isReachingEnd, loadMore } = useInfinitePosts(fallbackData);
  
  // --- [핵심 추가 1] Intersection Observer 설정 ---
  const { setTarget, entry } = useIntersectionObserver({
    // 버튼이 화면에 보이기 200px 전에 로딩을 시작하여 사용자 경험을 향상시킵니다.
    rootMargin: '200px',
    threshold: 0.1,
  });

  // --- [핵심 추가 2] 관찰 결과에 따라 loadMore 함수를 호출하는 로직 ---
  useEffect(() => {
    // entry가 존재하고, 화면에 보이고 있으며(isIntersecting),
    // 현재 로딩 중이 아니고, 마지막 페이지가 아닐 때
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
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.postId} post={post} />
        ))}
        {isRefreshing && Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={`skeleton-${i}`} />)}
      </div>
      
      {/* --- [핵심 수정] '더 보기' 버튼 영역을 관찰 대상으로 지정 --- */}
      <div 
        ref={setTarget} // 이 div를 Intersection Observer의 관찰 대상으로 설정합니다.
        className="flex justify-center mt-12 h-10" // 로딩 스피너를 위한 최소 높이 설정
      >
        {/* 마지막 페이지가 아니고, 현재 로딩 중일 때만 스피너를 보여줍니다. */}
        {!isReachingEnd && isRefreshing && (
          <Spinner />
        )}
        {/* 
          '더 보기' 버튼은 이제 JavaScript가 비활성화된 사용자를 위한 '폴백(fallback)' 역할을 하거나,
          자동 로딩이 실패했을 때 '다시 시도' 버튼으로 활용할 수 있습니다.
          지금은 자동 로딩에 집중하기 위해 주석 처리하거나 숨겨둡니다.
        */}
        {/* 
        {!isReachingEnd && !isRefreshing && (
          <button onClick={loadMore}>더 보기</button>
        )}
        */}
      </div>
    </>
  );
}