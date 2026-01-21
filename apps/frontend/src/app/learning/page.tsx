import { Suspense } from 'react';
import { api } from "@/utils/api";
import PostList from "@/components/PostList";
import FeaturedPostSkeleton from '@/components/FeaturedPostSkeleton';
import TagFilterSkeleton from '@/components/TagFilterSkeleton';

// Learning 페이지는 항상 최신 데이터를 보여주도록 설정
export const dynamic = 'force-dynamic';

const LearningPageSkeleton = () => (
    <>
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-8 animate-pulse"></div>
        <FeaturedPostSkeleton />
        <TagFilterSkeleton />
    </>
);

export default async function LearningPage() {
    try {
        // [Epic 6] category='learning'으로 학습 노트만 조회
        // Learning 페이지는 FeaturedSection(Hero) 없이 리스트만 보여줍니다.
        // 필요하다면 별도의 소개 섹션을 추가할 수 있습니다.
        const initialLatestPostsData = await api.fetchLatestPosts(12, null, 'learning');

        return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Learning Notes</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        배운 것들을 기록하고 정리하는 공간입니다. (AI 학습 데이터로 활용됩니다)
                    </p>
                </div>

                <Suspense fallback={<LearningPageSkeleton />}>
                    {/* Learning 모드에서는 TagFilter 등이 어떻게 동작할지 고려해야 함. 
                         현재 PostList는 내부에서 무한스크롤을 처리. 
                         Category context를 PostList에 전달해야 할 수도 있음.
                         하지만 PostList는 'use client' 컴포넌트이고, fetchMorePosts 로직이 내부에 있음.
                         PostList에도 category props를 추가해야 함! */}
                    <PostList fallbackData={initialLatestPostsData} initialCategory="learning" />
                </Suspense>
            </div>
        );
    } catch (err) {
        console.error("Failed to fetch learning posts on server:", err);
        const error = "학습 노트를 불러오는 데 실패했습니다.";
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">Learning Notes</h1>
                <p className="text-red-500">{error}</p>
            </div>
        );
    }
}
