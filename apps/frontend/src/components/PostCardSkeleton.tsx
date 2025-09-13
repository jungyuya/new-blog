// 파일 위치: apps/frontend/src/components/PostCardSkeleton.tsx
export default function PostCardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-lg shadow-lg">
      {/* 썸네일 스켈레톤 */}
      <div className="w-full aspect-video bg-gray-200 animate-pulse"></div>
      
      {/* 콘텐츠 스켈레톤 */}
      <div className="flex flex-col flex-1 p-6">
        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="flex flex-wrap gap-2 mt-auto pt-4">
          <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {/* 푸터 스켈레톤 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );
}