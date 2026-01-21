// 파일 위치: apps/frontend/src/app/page.tsx
import { Suspense } from 'react';
import { api } from "@/utils/api";
import PostList from "@/components/PostList";
import FeaturedSection from "@/components/FeaturedSection";
import FeaturedPostSkeleton from '@/components/FeaturedPostSkeleton';
import TagFilterSkeleton from '@/components/TagFilterSkeleton';
import CategoryDropdown from '@/components/CategoryDropdown';

export const dynamic = 'force-dynamic';

const HomePageSkeleton = () => (
  <>
    <FeaturedPostSkeleton />
    <TagFilterSkeleton />
  </>
);

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

  try {
    const [featuredData, initialLatestPostsData] = await Promise.all([
      api.fetchFeaturedPosts(),
      api.fetchLatestPosts(12, null, category)
    ]);

    const { heroPost, editorPicks } = featuredData;

    return (
      <div>
        <Suspense fallback={<HomePageSkeleton />}>
          {/* 전체 보기일 때만 Featured 섹션을 보여줄지, 항상 보여줄지 결정해야 함. 
              사용자 경험상 '전체'일 때만 보여주는 것이 깔끔할 수 있으나, 
              일단은 항상 보여주되 필요하면 조건부 렌더링으로 변경 가능. */}
          {!category && <FeaturedSection heroPost={heroPost} editorPicks={editorPicks} />}
        </Suspense>

        <div className="flex justify-between items-center mb-8 mt-12 border-b border-gray-200 dark:border-gray-800 pb-4">
          <h1 className="text-3xl font-bold dark:text-gray-100">{pageTitle}</h1>
          <CategoryDropdown />
        </div>

        <PostList
          fallbackData={initialLatestPostsData}
          initialCategory={category}
        />
      </div>
    );
  } catch (err) {
    console.error("Failed to fetch posts on server:", err);
    console.log(err)
    const error = "게시물 목록을 불러오는 데 실패했습니다.";
    return (
      <div>
        <div className="flex justify-between items-center mb-8 mt-12 border-b border-gray-200 dark:border-gray-800 pb-4">
          <h1 className="text-3xl font-bold dark:text-gray-100">{pageTitle}</h1>
          <CategoryDropdown />
        </div>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
}