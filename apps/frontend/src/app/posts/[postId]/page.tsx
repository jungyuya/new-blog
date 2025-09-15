// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.5 - await params 적용)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import CommentsSection from "@/components/comments/CommentsSection";
import type { Metadata, ResolvingMetadata } from 'next'

export const dynamic = 'force-dynamic';

// <-- 변경: params를 Promise로 선언
type Props = {
  params: Promise<{ postId: string }> | { postId: string }; // 안전하게 union으로 허용
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function PostDetailPage({ params }: Props) {
  // --- [핵심 수정] Next.js 15의 변경 사항에 따라, params를 사용하기 전에 await 합니다. ---
  const awaitedParams = await params;
  const { postId } = awaitedParams;

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

//  동적 메타데이터 생성 (SEO 최적화) - 임시 OFF
/* export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    // [참고] generateMetadata 내부에서도 동일하게 await이 필요할 수 있습니다.
    const awaitedParams = await params;
    const { postId } = awaitedParams;
    const { post } = await api.fetchPostById(postId);
 
    return {
      title: post.title,
      description: post.summary,
    }
  } catch (error) {
    return {
      title: '게시물을 찾을 수 없음',
      description: '요청하신 게시물을 찾을 수 없습니다.',
    }
  }
} */