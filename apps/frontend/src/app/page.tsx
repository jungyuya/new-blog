// 파일 위치: apps/frontend/src/app/page.tsx
import { Suspense } from 'react';
import { api } from "@/utils/api";
import PostList from "@/components/PostList";
import FeaturedSection from "@/components/FeaturedSection";
import FeaturedPostSkeleton from '@/components/FeaturedPostSkeleton';
import TagFilterSkeleton from '@/components/TagFilterSkeleton';

export const dynamic = 'force-dynamic';

const HomePageSkeleton = () => (
  <>
    <FeaturedPostSkeleton />
    <TagFilterSkeleton />
  </>
);

export default async function HomePage() {
  try {
    // [수정] fetchPosts -> fetchLatestPosts로 변경
    const [featuredData, initialLatestPostsData] = await Promise.all([
      api.fetchFeaturedPosts(),
      api.fetchLatestPosts(12, null) 
    ]);

    const { heroPost, editorPicks } = featuredData;

    return (
      <div>
        <Suspense fallback={<HomePageSkeleton />}>
          <FeaturedSection heroPost={heroPost} editorPicks={editorPicks} />
        </Suspense>

        <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">최신 게시물</h1>
        {/* [수정] fallbackData를 initialLatestPostsData로 변경하고, excludeIds prop을 제거합니다. */}
        <PostList fallbackData={initialLatestPostsData} />
      </div>
    );
  } catch (err) {
    console.error("Failed to fetch posts on server:", err);
    const error = "게시물 목록을 불러오는 데 실패했습니다.";
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">최신 게시물</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
}