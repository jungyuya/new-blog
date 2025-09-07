// 파일 위치: apps/frontend/src/components/PostFooter.tsx
'use client';

// 이 컴포넌트가 받을 props 타입을 정의합니다.
interface PostFooterProps {
  postId: string; // 나중에 '좋아요' API 호출 등에 사용될 수 있습니다.
}

/**
 * 게시물 하단에 위치하며, 좋아요 버튼, 관련 글 목록 등
 * 추가적인 인터랙션이나 정보를 담을 컴포넌트입니다.
 */
export default function PostFooter({ postId: _postId }: PostFooterProps) {
  return (
    <footer className="mt-12 pt-8 border-t">
      {/* 
        이곳에 나중에 Phase 4에서 '좋아요' 버튼 컴포넌트나
        '이전/다음 글' 링크 등이 추가될 예정입니다.
      */}
      <div className="text-center text-gray-500">
        {/* 임시 플레이스홀더 */}
        <p>🛠️댓글 기능이 추가될 공간입니다.🛠️</p>
      </div>
    </footer>
  );
}