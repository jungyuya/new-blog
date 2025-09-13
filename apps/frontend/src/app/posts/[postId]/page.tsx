// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (v1.4 - 최신 표준 패턴 적용)
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import CommentsSection from "@/components/comments/CommentsSection";

export const dynamic = 'force-dynamic';

// [신규] 페이지 컴포넌트의 props 타입을 명시적으로 정의합니다.
interface PostDetailPageProps {
  params: {
    postId: string;
  };
}

// [수정] props 타입으로 위에서 정의한 인터페이스를 사용합니다.
export default async function PostDetailPage({ params }: PostDetailPageProps) {
  // [수정] params는 이제 일반 객체이므로, await 구문을 제거합니다.
  const { postId } = params;

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