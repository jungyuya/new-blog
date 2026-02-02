// 파일 위치: apps/frontend/src/app/page.tsx
import { Suspense } from 'react';
import CategoryDropdown from '@/components/CategoryDropdown';
import FeaturedSectionContainer from '@/components/FeaturedSectionContainer';
import PostListContainer from '@/components/PostListContainer';
import DebouncedSkeleton from '@/components/DebouncedSkeleton';
import FeaturedPostSkeleton from '@/components/FeaturedPostSkeleton';
import TagFilterSkeleton from '@/components/TagFilterSkeleton';
import PostCardSkeleton from '@/components/PostCardSkeleton';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const category = resolvedSearchParams.category as 'post' | 'learning' | undefined;

  // 카테고리에 따른 제목 설정
  let pageTitle = '최신 게시물';
  if (category === 'post') pageTitle = '회고록';
  if (category === 'learning') pageTitle = '학습 노트';

  // [Streaming SSR]
  // 기존의 Promise.all 직렬 로딩을 제거하고, 각 섹션을 Suspense로 감싸 병렬 로딩합니다.
  // DebouncedSkeleton을 사용하여 즉각적인 응답(Warm Start) 시 깜빡임을 방지합니다.

  return (
    <div>
      {/* Featured Section (Hero + Editor Picks + Tags) */}
      {!category && (
        <Suspense
          fallback={
            <DebouncedSkeleton>
              <FeaturedPostSkeleton />
              <TagFilterSkeleton />
            </DebouncedSkeleton>
          }
        >
          <FeaturedSectionContainer />
        </Suspense>
      )}

      {/* Page Title & Category Dropdown */}
      <div className="flex justify-between items-center mb-8 mt-12 border-b border-gray-200 dark:border-gray-800 pb-4">
        <h1 className="text-3xl font-bold dark:text-gray-100">{pageTitle}</h1>
        <CategoryDropdown />
      </div>

      {/* Post List */}
      <Suspense
        fallback={
          <DebouncedSkeleton>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <PostCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          </DebouncedSkeleton>
        }
      >
        <PostListContainer initialCategory={category} />
      </Suspense>
    </div>
  );
}