// apps/frontend/src/components/PostDetailView.tsx
'use client';
import type { Post } from "@/utils/api";
import Link from "next/link";

export default function PostDetailView({ post }: { post: Post | null }) {
  if (!post) {
    return (
      <main className="flex min-h-screen flex-col items-center p-24">
        <h1 className="text-4xl font-bold mb-8">게시물을 찾을 수 없습니다.</h1>
        <Link href="/" className="text-blue-600 hover:underline">목록으로 돌아가기</Link>
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
        <div className="prose lg:prose-xl max-w-none whitespace-pre-wrap">{post.content}</div>
        <div className="mt-12 border-t pt-6">
          <Link href="/" className="text-blue-600 hover:underline">← 목록으로 돌아가기</Link>
        </div>
      </article>
    </main>
  );
}