// 파일 위치: apps/frontend/src/app/page.tsx
import { Suspense } from 'react';
import { api } from "@/utils/api";
import PostList from "@/components/PostList";
import FeaturedSection from "@/components/FeaturedSection";
import FeaturedPostSkeleton from '@/components/FeaturedPostSkeleton';
import TagFilterSkeleton from '@/components/TagFilterSkeleton'; // [추가]

export const dynamic = 'force-dynamic';
const POSTS_PER_PAGE = 12;

// [추가] 로딩 경험 통일을 위한 통합 스켈레톤
const HomePageSkeleton = () => (
  <>
    <FeaturedPostSkeleton />
    <TagFilterSkeleton />
  </>
);

export default async function HomePage() {
  try {
    // [수정] 두 API를 병렬로 호출하는 것은 동일합니다.
    const [featuredData, initialPostsData] = await Promise.all([
      api.fetchFeaturedPosts(),
      api.fetchPosts(POSTS_PER_PAGE, null)
    ]);

    // [수정] 새로운 응답 구조에 맞춰 heroPost와 editorPicks를 직접 구조 분해 할당합니다.
    const { heroPost, editorPicks } = featuredData;

    // [수정] 중복 제거를 위한 ID 목록을 생성합니다. heroPost가 있을 경우와 없을 경우 모두 처리합니다.
    const featuredPostIds = [
      ...(heroPost ? [heroPost.postId] : []),
      ...editorPicks.map(p => p.postId)
    ];

    return (
      <div>
        <Suspense fallback={<HomePageSkeleton />}>
          {/* [수정] FeaturedSection에 heroPost와 editorPicks를 별도의 prop으로 전달합니다. */}
          <FeaturedSection heroPost={heroPost} editorPicks={editorPicks} />
        </Suspense>

        <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">최신 게시물</h1>
        <PostList fallbackData={initialPostsData} excludeIds={featuredPostIds} />
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