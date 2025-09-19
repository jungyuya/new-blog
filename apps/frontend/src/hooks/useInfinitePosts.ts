// 파일 위치: apps/frontend/src/hooks/useInfinitePosts.ts
'use client';

import useSWRInfinite from 'swr/infinite';
import { api, Post, PaginatedPosts } from '@/utils/api';

const POSTS_PER_PAGE = 12;

const fetcher = (url: string) => {
  const params = new URLSearchParams(url.split('?')[1]);
  const cursor = params.get('cursor');
  return api.fetchPosts(POSTS_PER_PAGE, cursor);
};

/**
 * @param fallbackData - 서버 사이드에서 미리 렌더링된 첫 페이지 데이터
 * @param excludeIds - [신규] 목록에서 제외할 게시물 ID 배열
 */
// [수정] 1. 두 번째 인자로 excludeIds를 받도록 훅의 시그니처를 변경합니다.
export function useInfinitePosts(fallbackData: PaginatedPosts, excludeIds: string[] = []) {
  const getKey = (pageIndex: number, previousPageData: PaginatedPosts | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    if (pageIndex === 0) return `/posts?limit=${POSTS_PER_PAGE}`;
    return `/posts?limit=${POSTS_PER_PAGE}&cursor=${previousPageData!.nextCursor}`;
  };

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<PaginatedPosts>(
    getKey,
    fetcher,
    {
      fallbackData: [fallbackData],
      revalidateFirstPage: false,
    }
  );

  // [수정] 2. SWR 데이터를 펼친 후, excludeIds에 포함된 게시물을 필터링합니다.
  const posts: Post[] = data
    ? data.flatMap(page => page.posts).filter(post => !excludeIds.includes(post.postId))
    : [];
  
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