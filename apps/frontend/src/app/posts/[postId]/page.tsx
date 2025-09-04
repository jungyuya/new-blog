// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.1 - Layout Applied)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  // [핵심 수정] Next.js 15의 변경 사항에 따라, params를 사용하기 전에 await 합니다.
  const awaitedParams = await params;
  const { postId } = awaitedParams;

  try {
    const { post } = await api.fetchPostById(postId);

    if (!post) {
      notFound();
    }

    // [핵심] PostDetailView를 중앙 정렬 및 여백을 가진 레이아웃으로 감쌉니다.
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <PostDetailView post={post} />
      </div>
    );

  } catch (error) {
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound();
  }
}