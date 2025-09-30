// 파일 위치: apps/frontend/src/components/PostDetailView.tsx
'use client';

import { Post, AdjacentPost } from '@/utils/api';
import PostHeader from './PostHeader';
import PostContent from './PostContent';
import { Heading } from '@/utils/toc';
import PostUtilButtons from './PostUtilButtons';
import PostAuthorProfile from './PostAuthorProfile';
import dynamic from 'next/dynamic'; // [추가]
import { useEffect } from "react";



// [추가] CommentsSection을 동적으로 import 합니다.
const CommentsSection = dynamic(
  () => import('@/components/comments/CommentsSection'),
  {
    ssr: false,
    loading: () => (
      <div className="py-8 mt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="mt-4 py-4 text-center text-gray-500 dark:text-gray-400">
          댓글을 불러오는 중...
        </div>
      </div>
    ),
  }
);

interface PostDetailViewProps {
  post: Post | null;
  prevPost: AdjacentPost | null;
  nextPost: AdjacentPost | null;
  postId: string;
  headings: Heading[];
}

export default function PostDetailView({ post, prevPost, nextPost, postId, headings }: PostDetailViewProps) {
  // --- [디버깅용 코드] headings 데이터를 콘솔에 출력 ---
  useEffect(() => {
    console.log('Generated Headings:', headings);
  }, [headings]);
  // --- 디버깅용 코드 끝 ---
  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">게시물을 찾을 수 없습니다.</h1>
        <p className="mt-4 text-gray-600">요청하신 페이지를 찾을 수 없거나, 삭제된 게시물일 수 있습니다.</p>
      </div>
    );
  }

  return (
    <>
      <PostHeader post={post} />
      {/* --- [수정] PostContent에 headings prop 전달 --- */}
      <PostContent content={post.content!} headings={headings} />
      <PostAuthorProfile post={post} />
      <PostUtilButtons post={post} prevPost={prevPost} nextPost={nextPost} />
      <CommentsSection postId={postId} />
    </>
  );
}