'use client';

export default function PostDetailSkeleton() {
    return (
        <div className="max-w-[64rem] mx-auto animate-pulse">
            {/* Header Skeleton */}
            <div className="mb-8">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="h-10 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="flex gap-2">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-64 w-full bg-gray-200 dark:bg-gray-700 rounded mt-8" />
            </div>
        </div>
    );
}
