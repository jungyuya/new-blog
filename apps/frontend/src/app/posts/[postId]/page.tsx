// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.3 - 이전/다음 글 데이터 전달)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import CommentsSection from "@/components/comments/CommentsSection";

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const awaitedParams = await params;
  const { postId } = awaitedParams;

  try {
    // API 응답에서 post, prevPost, nextPost를 모두 받습니다. (이 부분은 이미 올바르게 되어 있습니다.)
    const { post, prevPost, nextPost } = await api.fetchPostById(postId);

    if (!post) {
      notFound();
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* --- [핵심 수정] PostDetailView에 prevPost와 nextPost를 props로 전달합니다. --- */}
        <PostDetailView post={post} prevPost={prevPost} nextPost={nextPost} />
        
        <CommentsSection postId={postId} />
      </div>
    ); 

  } catch (error) {
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound();
  }
}