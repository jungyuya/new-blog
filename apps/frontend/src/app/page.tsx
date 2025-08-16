// 파일 위치: apps/frontend/src/app/page.tsx (수정)
// 역할: 블로그의 메인 페이지. 서버 컴포넌트로서 전체 게시물 목록을 보여줍니다.

import { api, Post } from "@/utils/api";
import Link from "next/link";

// [개념 설명] 이 페이지는 'use client' 지시어가 없으므로 '서버 컴포넌트'입니다.
// 따라서 이 async 함수는 사용자의 브라우저가 아닌, 서버(AWS Lambda)에서 실행됩니다.
export const dynamic = 'force-dynamic';
export default async function HomePage() {
  
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    // 서버 환경에서 api.fetchPosts()를 호출합니다.
    // api.ts의 getApiBaseUrl() 함수가 서버 환경임을 인지하고,
    // INTERNAL_API_ENDPOINT 환경 변수를 사용하여 절대 경로로 API를 호출합니다.
    const response = await api.fetchPosts();
    posts = response.posts;
  } catch (err) {
    console.error("Failed to fetch posts on server:", err);
    error = "게시물 목록을 불러오는 데 실패했습니다.";
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">최신 게시물</h1>
      
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post) => (
            <Link 
              href={`/posts/${post.postId}`} 
              key={post.postId} 
              className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-100"
            >
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">{post.title}</h2>
              <p className="font-normal text-gray-700">
                작성자: {post.authorEmail} | 작성일: {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p>아직 작성된 게시물이 없습니다.</p>
      )}
    </div>
  );
}