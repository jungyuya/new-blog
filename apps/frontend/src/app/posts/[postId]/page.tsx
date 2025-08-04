// apps/frontend/src/app/posts/[postId]/page.tsx (타입 문제 최종 해결 버전)

import { fetchPostById } from "@/utils/api";
import Link from "next/link";
import type { Metadata } from 'next'; // Metadata 타입을 import 합니다.

// 1. [핵심 수정] 페이지 컴포넌트의 props 타입을 명시적으로 정의합니다.
//    이것이 Next.js App Router의 동적 페이지에 대한 가장 표준적인 타입 정의 방식입니다.
type Props = {
  params: { postId: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// 2. [핵심 추가] 동적 Metadata 생성 함수를 추가합니다.
//    이 함수는 서버 컴포넌트에서만 작동하며, 페이지의 <head> 태그를 동적으로 설정합니다.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await fetchPostById(params.postId);
  
  if (!post) {
    return {
      title: '게시물을 찾을 수 없음',
    };
  }

  return {
    title: post.title,
    description: post.content.substring(0, 150), // 내용의 일부를 설명으로 사용
  };
}

// 3. 페이지 컴포넌트는 위에서 정의한 Props 타입을 사용합니다.
export default async function PostDetailPage({ params }: Props) {
  const { postId } = params;
  
  const post = await fetchPostById(postId);

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

  return (
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
  );
}