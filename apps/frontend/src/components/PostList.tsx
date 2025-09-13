// 파일 위치: apps/frontend/src/components/PostList.tsx
'use client';

import { PaginatedPosts } from '@/utils/api';
import { useInfinitePosts } from '@/hooks/useInfinitePosts';
import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';

interface PostListProps {
  fallbackData: PaginatedPosts;
}

export default function PostList({ fallbackData }: PostListProps) {
  const { posts, error, isRefreshing, isReachingEnd, loadMore } = useInfinitePosts(fallbackData);

  if (error) return <p className="text-red-500">게시물 목록을 불러오는 데 실패했습니다.</p>;
  
  // fallbackData가 비어있고, 로딩도 끝났는데 게시물이 없는 경우
  if (posts.length === 0 && !isRefreshing) {
    return <p>아직 작성된 게시물이 없습니다.</p>;
  }

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.postId} post={post} />
        ))}
        {/* 2페이지부터 로딩할 때 스켈레톤 UI를 보여줍니다. */}
        {isRefreshing && Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={`skeleton-${i}`} />)}
      </div>
      
      {/* 마지막 페이지가 아닐 때만 '더 보기' 버튼을 보여줍니다. */}
      {!isReachingEnd && (
        <div className="flex justify-center mt-12">
          <button
            onClick={loadMore}
            disabled={isRefreshing}
            className="px-6 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
          >
            {isRefreshing ? '로딩 중...' : '더 보기'}
          </button>
        </div>
      )}
    </>
  );
}