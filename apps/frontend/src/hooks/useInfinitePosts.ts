// 파일 위치: apps/frontend/src/hooks/useInfinitePosts.ts
'use client';

import useSWRInfinite from 'swr/infinite';
import { api, Post, PaginatedPosts } from '@/utils/api';

const POSTS_PER_PAGE = 12; // 한 페이지에 불러올 게시물 수

// useSWRInfinite를 위한 fetcher 함수입니다.
// SWR은 key(이 경우 URL 문자열)를 이 함수에 인자로 전달합니다.
const fetcher = (url: string) => {
  const params = new URLSearchParams(url.split('?')[1]);
  const cursor = params.get('cursor');
  // api.ts의 fetchPosts 함수를 호출합니다. limit은 상수로 고정합니다.
  return api.fetchPosts(POSTS_PER_PAGE, cursor);
};

/**
 * 게시물 목록의 무한 로딩을 관리하는 커스텀 훅입니다.
 * @param fallbackData - 서버 사이드에서 미리 렌더링된 첫 페이지 데이터
 * @returns 게시물 목록, 로딩 상태, '더 보기' 함수 등
 */
export function useInfinitePosts(fallbackData: PaginatedPosts) {
  // getKey 함수는 SWR에게 각 페이지를 요청할 고유한 키(이 경우 URL)를 알려줍니다.
  const getKey = (pageIndex: number, previousPageData: PaginatedPosts | null) => {
    // `previousPageData`는 바로 이전 페이지의 API 응답 데이터입니다.
    
    // 1. 마지막 페이지에 도달한 경우:
    // 이전 페이지 데이터가 있고, 그 데이터의 nextCursor가 null이면 더 이상 요청하지 않도록 null을 반환합니다.
    if (previousPageData && !previousPageData.nextCursor) return null;

    // 2. 첫 페이지(index 0)의 키를 생성합니다.
    // 이 키는 fallbackData에 해당하므로, 실제로는 요청이 발생하지 않습니다.
    if (pageIndex === 0) return `/posts?limit=${POSTS_PER_PAGE}`;

    // 3. 다음 페이지(index 1 이상)의 키를 생성합니다.
    // 이전 페이지의 nextCursor를 사용하여 다음 요청 URL을 만듭니다.
    return `/posts?limit=${POSTS_PER_PAGE}&cursor=${previousPageData!.nextCursor}`;
  };

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<PaginatedPosts>(
    getKey,
    fetcher,
    {
      // SSR로 받아온 첫 페이지 데이터를 SWR의 초기 캐시 데이터로 설정합니다.
      fallbackData: [fallbackData],
      // 첫 페이지 데이터는 이미 있으므로, 클라이언트에서 다시 불러오지 않도록 설정합니다.
      revalidateFirstPage: false,
    }
  );

  // SWR이 반환하는 데이터는 페이지별 배열의 배열([ [page1_data], [page2_data] ]) 형태입니다.
  // 이를 사용하기 쉬운 1차원 배열로 변환(flatten)합니다.
  const posts: Post[] = data ? data.flatMap(page => page.posts) : [];
  
  // 마지막 페이지에 도달했는지 여부를 나타내는 boolean 값입니다.
  const isReachingEnd = data ? data[data.length - 1]?.nextCursor === null : false;

  // 외부 컴포넌트에서 사용할 상태와 함수들을 useLike.ts와 유사한 형태로 정리하여 반환합니다.
  return {
    posts,
    error,
    isLoading,      // fallbackData가 없을 때의 초기 로딩 상태
    isRefreshing: isValidating, // 추가 페이지 로딩 또는 기존 데이터 갱신 시의 로딩 상태
    isReachingEnd,
    loadMore: () => setSize(size + 1), // '더 보기' 버튼에 연결할 함수
  };
}