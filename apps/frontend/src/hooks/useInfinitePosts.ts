// 파일 위치: apps/frontend/src/hooks/useInfinitePosts.ts
'use client';

import useSWRInfinite from 'swr/infinite';
import { api, Post, PaginatedPosts } from '@/utils/api';

const POSTS_PER_PAGE = 12;

// [수정] fetcher가 이제 'api.fetchLatestPosts'를 사용합니다.
const fetcher = (url: string) => {
  const params = new URLSearchParams(url.split('?')[1]);
  const cursor = params.get('cursor');
  return api.fetchLatestPosts(POSTS_PER_PAGE, cursor);
};

// [수정] excludeIds 파라미터를 제거합니다.
export function useInfinitePosts(fallbackData: PaginatedPosts) {
  const getKey = (pageIndex: number, previousPageData: PaginatedPosts | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    // [수정] 경로를 '/posts/latest'로 변경하고, 키에서 excludeIds를 제거합니다.
    if (pageIndex === 0) return `/posts/latest?limit=${POSTS_PER_PAGE}`;
    return `/posts/latest?limit=${POSTS_PER_PAGE}&cursor=${previousPageData!.nextCursor}`;
  };

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<PaginatedPosts>(
    getKey,
    fetcher,
    {
      fallbackData: [fallbackData],
      revalidateOnMount: true,
    }
  );

  // [수정] 클라이언트 사이드 필터링을 완전히 제거합니다.
  const posts: Post[] = data ? data.flatMap(page => page.posts) : [];
  
  const isReachingEnd = data ? data[data.length - 1]?.nextCursor === null : false;

  return {
    posts,
    error,
    isLoading,
    isRefreshing: isValidating,
    isReachingEnd,
    size,
    loadMore: () => setSize(size + 1),
  };
}