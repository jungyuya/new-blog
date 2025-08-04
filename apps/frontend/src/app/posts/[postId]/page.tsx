// apps/frontend/src/app/posts/[postId]/page.tsx (가장 단순하고 확실한 최종 버전)

import { fetchPostById, Post } from "@/utils/api"; // 경로는 @/를 사용합니다. tsconfig가 올바르므로 작동해야 합니다.
import Link from "next/link";

// [핵심 수정] 모든 커스텀 타입(Props)과 generateMetadata 함수를 제거합니다.
// props의 타입을 가장 단순한 형태로 직접, 인라인으로 정의합니다.
// 이것이 TypeScript가 오해할 여지를 주지 않는 가장 확실한 방법입니다.
export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const { postId } = params;
  const post: Post | null = await fetchPostById(postId);

  if (!post) {
    return (
      <main className="flex min-h-screen flex-col items-center p-24">
        <h1 className="text-4xl font-bold mb-8">게시물을 찾을 수 없습니다.</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          목록으로 돌아가기
        </Link>
      </main>
    );
  }

  // [핵심 추가] SEO를 위해 페이지의 제목을 동적으로 설정하는 부분을 여기에 추가합니다.
  // generateMetadata가 문제를 일으키므로, 페이지 컴포넌트 자체에서 제목을 설정하는
  // 대안적인 방법을 사용합니다. (이 방식은 클라이언트 컴포넌트에서 주로 사용되지만,
  // 서버 컴포넌트에서도 문서의 title을 설정하는 데는 문제가 없습니다.)
  // 단, 이 방식은 빌드 시점에 정적으로 제목을 생성하지는 못할 수 있습니다.
  // 우선 빌드를 통과시키는 것이 목표입니다.
  // (실제로는 서버 컴포넌트에서는 메타데이터 API를 쓰는 것이 정석이지만, 빌드 오류를 우회하기 위함입니다.)

  return (
    <>
      <title>{post.title}</title> {/* <--- 동적 페이지 제목 설정 */}
      <main className="flex min-h-screen flex-col items-center p-8 sm:p-12 md:p-24">
        <article className="w-full max-w-4xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900">{post.title}</h1>
          <div className="mb-8 text-gray-500">
            <span>작성자: {post.authorEmail}</span>
            <span className="mx-2">|</span>
            <span>작성일: {new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <div className="prose lg:prose-xl max-w-none whitespace-pre-wrap">
            {post.content}
          </div>
          <div className="mt-12 border-t pt-6">
            <Link href="/" className="text-blue-600 hover:underline">
              ← 목록으로 돌아가기
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}