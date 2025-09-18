// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.6 - 타입 오류 해결)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import CommentsSection from "@/components/comments/CommentsSection";
import type { Metadata, ResolvingMetadata } from 'next'

export const dynamic = 'force-dynamic';

// 수정: Next.js 15 표준 타입으로 변경
type Props = {
  params: Promise<{ postId: string }>; // Promise만 허용 (union 타입 제거)
  searchParams: Promise<Record<string, string | string[] | undefined>>; // searchParams도 Promise로 수정
};

export default async function PostDetailPage({ params }: Props) {
  // Next.js 15의 변경 사항에 따라 params를 await
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

// 동적 메타데이터 생성 (SEO 최적화) - 활성화 및 수정
/* export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const { postId } = await params;
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
}
  */