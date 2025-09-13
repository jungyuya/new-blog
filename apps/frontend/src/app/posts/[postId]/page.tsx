// apps/frontend/src/app/posts/[postId]/page.tsx
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from "next/navigation";
import CommentsSection from "@/components/comments/CommentsSection";

export const dynamic = 'force-dynamic';

type ParamsShape = { postId: string };

// params가 동기 객체일 수도, Promise일 수도 있게 허용
interface PostDetailPageProps {
  params: ParamsShape | Promise<ParamsShape>;
  // searchParams 등 다른 props가 필요하면 여기에 추가
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  // Promise/동기 모두 안전하게 처리
  const { postId } = await params;

  try {
    const { post, prevPost, nextPost } = await api.fetchPostById(postId);

    if (!post) {
      notFound();
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <PostDetailView post={post} prevPost={prevPost} nextPost={nextPost} />
        <CommentsSection postId={postId} />
      </div>
    );
  } catch (error) {
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound();
  }
}
