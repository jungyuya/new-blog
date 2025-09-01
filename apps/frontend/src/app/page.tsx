// 파일 위치: apps/frontend/src/app/page.tsx (v1.1 - PostCard 적용 최종본)
import { api, Post } from "@/utils/api";
// [추가] PostCard 컴포넌트를 import 합니다.
import PostCard from "@/components/PostCard";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    const response = await api.fetchPosts();
    posts = response.posts;
  } catch (err) {
    console.error("Failed to fetch posts on server:", err);
    error = "게시물 목록을 불러오는 데 실패했습니다.";
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">최신 게시물</h1>
      
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : posts.length > 0 ? (
        // [핵심 수정] 기존 목록을 Grid 레이아웃으로 변경하고, PostCard를 사용합니다.
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.postId} post={post} />
          ))}
        </div>
      ) : (
        <p>아직 작성된 게시물이 없습니다.</p>
      )}
    </div>
  );
}