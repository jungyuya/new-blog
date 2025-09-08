// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.2 - CommentsSection 추가)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import CommentsSection from "@/components/comments/CommentsSection"; // [신규] CommentsSection import

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const awaitedParams = await params;
  const { postId } = awaitedParams;

  try {
    const { post } = await api.fetchPostById(postId);

    if (!post) {
      notFound();
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <PostDetailView post={post} />
        
        {/* --- [신규] 댓글 섹션 컴포넌트를 여기에 추가합니다 --- */}
        <CommentsSection postId={postId} />
      </div>
    ); 

  } catch (error) {
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound();
  }
}