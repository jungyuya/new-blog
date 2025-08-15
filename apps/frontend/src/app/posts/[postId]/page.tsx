// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx (수정)

// [수정] 개별 함수 대신, 'api' 객체 전체를 import 합니다.
import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation'; // [추가] 404 페이지를 보여주기 위한 Next.js 내장 함수

// [개선] 이 컴포넌트는 서버에서 데이터를 fetch하므로 async 함수로 유지합니다.
export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const { postId } = params;

  try {
    // [수정] 'fetchPostById(postId)' 대신 'api.fetchPostById(postId)'를 호출합니다.
    // api.ts에서 반환하는 값은 { post: Post } 형태이므로, 구조 분해 할당을 사용합니다.
    const { post } = await api.fetchPostById(postId);
    
    // [개선] api.fetchPostById가 실패하면 에러를 throw하므로,
    // post가 없는 경우는 404 에러로 간주하고 notFound()를 호출하는 것이 더 명확합니다.
    // (물론 api.ts의 에러 처리 로직에 따라 이 부분은 달라질 수 있지만, 현재 구조에서는 이 방식이 안전합니다.)
    if (!post) {
      notFound();
    }

    return <PostDetailView post={post} />;

  } catch (error) {
    // [개선] api.fetchPostById가 404 에러를 포함하여 어떤 에러든 throw하면,
    // Next.js의 기본 에러 처리 메커니즘에 따라 404 페이지나 에러 페이지를 보여줍니다.
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound(); // API 호출 실패 시 (e.g., 존재하지 않는 postId) 404 페이지를 보여줍니다.
  }
}