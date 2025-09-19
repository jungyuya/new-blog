// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
// [수정] CommentsSection import는 이제 PostDetailView에서 처리하므로 제거합니다.
// import CommentsSection from "@/components/comments/CommentsSection"; 
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PostDetailPage({ params }: Props) {
  const { postId } = await params;

  try {
    const { post, prevPost, nextPost } = await api.fetchPostById(postId);
    if (!post) {
      notFound();
    }

    return (
      // [핵심 수정] 모바일(기본) 좌우 패딩을 px-0으로 제거합니다.
      // sm 화면부터 패딩을 다시 적용하여 데스크탑 경험은 그대로 유지합니다.
      <div className="max-w-4xl mx-auto px-0 py-6 sm:px-6 lg:px-8 sm:py-8">
        <PostDetailView post={post} prevPost={prevPost} nextPost={nextPost} postId={postId} />
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