// 파일 위치: apps/frontend/src/components/PostCardSkeleton.tsx
export default function PostCardSkeleton() {
  return (
    // [수정] 1. 스켈레톤 카드 컨테이너에 다크 모드 스타일 적용 (PostCard와 동일)
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-lg shadow-lg dark:bg-stone-700 dark:shadow-none dark:border dark:border-gray-800">
      {/* [수정] 2. 스켈레톤 요소들의 배경색을 다크 모드에 맞게 변경 */}
      <div className="w-full aspect-video bg-gray-200 animate-pulse dark:bg-gray-600"></div>
      
      <div className="flex flex-col flex-1 p-6">
        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse mb-4 dark:bg-gray-600"></div>
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2 dark:bg-gray-600"></div>
        <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse mb-4 dark:bg-gray-600"></div>
        <div className="flex flex-wrap gap-2 mt-auto pt-4">
          <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse dark:bg-gray-600"></div>
          <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse dark:bg-gray-600"></div>
        </div>
      </div>
      
      {/* [수정] 3. 푸터 영역의 테두리 및 스켈레톤 요소 색상 변경 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse dark:bg-gray-600"></div>
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse dark:bg-gray-600"></div>
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse dark:bg-gray-600"></div>
      </div>
    </div>
  );
}