// 파일 위치: apps/frontend/src/components/PostFooter.tsx
'use client';

interface PostFooterProps {
  postId: string;
}

export default function PostFooter({ postId: _postId }: PostFooterProps) {
  return (
    // [수정] 1. footer 컨테이너의 상단 테두리에 다크 모드 색상 적용
    <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="text-center text-gray-500 dark:text-gray-400">
      </div>
    </footer>
  );
}