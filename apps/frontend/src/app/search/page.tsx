// 파일 위치: apps/frontend/src/app/search/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api, Post } from '@/utils/api';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';

// SWR을 위한 fetcher 함수
const searchFetcher = (url: string) =>
    fetch(url).then((res: Response) => {
        if (!res.ok) {
            throw new Error('An error occurred while fetching the data.');
        }
        return res.json();
    });

export default function SearchPage() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');

    // SWR을 사용하여 검색 API를 호출합니다.
    // query가 있을 때만 API를 호출하도록 조건부 페칭을 사용합니다.
    const { data, error, isLoading } = useSWR(
        query ? `/api/search?q=${encodeURIComponent(query)}` : null,
        searchFetcher
    );

    // 로딩 상태 UI
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">
                    검색 중...
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <PostCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        );
    }

    // 에러 상태 UI
    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold text-red-500 dark:text-red-400">
                    검색 중 오류가 발생했습니다.
                </h1>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                    잠시 후 다시 시도해주세요.
                </p>
            </div>
        );
    }

    // 검색어가 없는 경우 (예: /search 로 직접 접근)
    if (!query) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold dark:text-gray-100">
                    무엇을 찾고 계신가요?
                </h1>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                    검색창을 이용해 블로그의 글을 찾아보세요.
                </p>
            </div>
        );
    }

    // 성공 상태 UI
    const searchResults: Post[] = data?.results || [];

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">
                <span className="text-indigo-500 dark:text-indigo-400">'{query}'</span>에 대한 검색 결과
                <span className="text-lg ml-2 text-gray-500 dark:text-gray-400">
                    ({searchResults.length}개)
                </span>
            </h1>

            {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {searchResults.map(post => (
                        <PostCard key={post.postId} post={post} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        검색 결과가 없습니다.
                    </p>
                </div>
            )}
        </div>
    );
}