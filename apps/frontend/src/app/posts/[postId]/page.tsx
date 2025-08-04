// apps/frontend/src/app/posts/[postId]/page.tsx
import { fetchPostById } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";

export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const { postId } = params;
  const post = await fetchPostById(postId);
  return <PostDetailView post={post} />;
}