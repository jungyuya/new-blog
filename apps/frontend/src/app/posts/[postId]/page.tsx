// apps/frontend/src/app/posts/[postId]/page.tsx (최종 완성본)

import { fetchPostById } from "@/utils/api"; // '@/utils/'는 'src/utils/'를 가리키는 별칭입니다.
import Link from "next/link";

// Next.js App Router는 페이지 컴포넌트에 'params'라는 특별한 prop을 전달해줍니다.
// 이 params 객체 안에는 동적 세그먼트(폴더 이름)의 실제 값이 들어있습니다.
// 예: URL이 /posts/123-abc 이면, params는 { postId: '123-abc' }가 됩니다.
type PostDetailPageProps = {
  params: {
    postId: string;
  };
};

// 이 페이지는 async 함수로 만들어 서버 컴포넌트로 작동합니다.
// 즉, 이 코드는 사용자의 브라우저가 아닌, 서버에서 실행됩니다.
export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = params;
  
  // 서버에서 직접 API 함수를 호출하여 게시물 데이터를 가져옵니다.
  const post = await fetchPostById(postId);

  // 만약 해당 postId의 게시물이 없다면 (fetchPostById가 null을 반환했다면)
  // 사용자에게 게시물이 없다는 메시지를 보여줍니다.
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

  // 게시물 데이터가 성공적으로 조회되었다면, 내용을 화면에 렌더링합니다.
  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-12 md:p-24">
      <article className="w-full max-w-4xl">
        {/* 게시물 제목 */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900">{post.title}</h1>
        
        {/* 작성자 및 작성일 정보 */}
        <div className="mb-8 text-gray-500">
          <span>작성자: {post.authorEmail}</span>
          <span className="mx-2">|</span>
          <span>작성일: {new Date(post.createdAt).toLocaleString()}</span>
        </div>

        {/* 게시물 내용 */}
        {/* whitespace-pre-wrap 클래스는 공백과 줄바꿈을 HTML에 그대로 표시해줍니다. */}
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
  );
}
