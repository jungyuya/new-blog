// 파일 위치: apps/frontend/src/app/search/page.tsx
import { Suspense } from 'react';
import SearchResults from './SearchResults';
import PostCardSkeleton from '@/components/PostCardSkeleton';

// Suspense의 fallback으로 사용될 로딩 스켈레톤
const SearchPageSkeleton = () => (
  <div className="container mx-auto px-4 py-8">
    <div className="h-9 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-8"></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  </div>
);

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchResults />
      </Suspense>
    </div>
  );
}