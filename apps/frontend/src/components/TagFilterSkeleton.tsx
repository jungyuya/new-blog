// 파일 위치: apps/frontend/src/components/TagFilterSkeleton.tsx
export default function TagFilterSkeleton() {
  return (
    <div className="mb-12 animate-pulse">
      <h2 className="text-2xl font-bold mb-4 h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded"></h2>
      <div className="flex flex-wrap gap-3">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
    </div>
  );
}