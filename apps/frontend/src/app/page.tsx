// 파일 위치: apps/frontend/src/app/page.tsx (v2.0 - 페이지네이션 적용)
import { api } from "@/utils/api";
// [수정] PostCard 대신, 동적 목록을 처리할 PostList를 import 합니다.
import PostList from "@/components/PostList";

export const dynamic = 'force-dynamic';

// 한 페이지에 보여줄 게시물 수를 상수로 정의합니다.
const POSTS_PER_PAGE = 12;

export default async function HomePage() {
  try {
    // --- [핵심 수정 1] ---
    // 서버에서 첫 페이지만 미리 가져옵니다.
    const initialPostsData = await api.fetchPosts(POSTS_PER_PAGE, null);

    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">최신 게시물</h1>
        
        {/* --- [핵심 수정 2] --- */}
        {/* 실제 렌더링 로직을 클라이언트 컴포넌트에 위임하고, 초기 데이터를 fallback으로 전달합니다. */}
        <PostList fallbackData={initialPostsData} />
      </div>
    );
  } catch (err) {
    // 기존의 에러 처리 방식을 유지합니다.
    console.error("Failed to fetch posts on server:", err);
    const error = "게시물 목록을 불러오는 데 실패했습니다.";
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">최신 게시물</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
}