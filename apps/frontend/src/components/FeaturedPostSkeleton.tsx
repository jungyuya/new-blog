// 파일 위치: apps/frontend/src/components/FeaturedPostSkeleton.tsx
export default function FeaturedPostSkeleton() {
  return (
    <div className="mb-12 animate-pulse">
      <h2 className="text-2xl font-bold mb-4 h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded"></h2>
      <div className="flex flex-col md:flex-row gap-8 bg-gray-100 dark:bg-stone-800 rounded-lg p-6">
        {/* 이미지 스켈레톤 */}
        <div className="w-full md:w-1/2 aspect-video bg-gray-300 dark:bg-gray-600 rounded-md"></div>
        {/* 텍스트 스켈레톤 */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <div className="h-8 w-3/4 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
          <div className="h-4 w-full bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
          <div className="h-4 w-5/6 bg-gray-300 dark:bg-gray-600 rounded mb-6"></div>
          <div className="h-10 w-32 bg-gray-300 dark:bg-gray-600 rounded-md"></div>
        </div>
      </div>
    </div>
  );
}