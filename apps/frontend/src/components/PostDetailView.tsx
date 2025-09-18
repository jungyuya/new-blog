// 파일 위치: apps/frontend/src/components/PostDetailView.tsx
'use client';

import { Post, AdjacentPost } from '@/utils/api';
import PostHeader from './PostHeader';
import PostContent from './PostContent';
import PostUtilButtons from './PostUtilButtons'; 
import PostAuthorProfile from './PostAuthorProfile';
import dynamic from 'next/dynamic'; // [추가]

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

// [수정] postId를 추가로 받도록 props 타입을 변경합니다.
interface PostDetailViewProps {
  post: Post | null;
  prevPost: AdjacentPost | null;
  nextPost: AdjacentPost | null;
  postId: string; // CommentsSection에 전달하기 위해 postId를 받습니다.
}

export default function PostDetailView({ post, prevPost, nextPost, postId }: PostDetailViewProps) {
  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">게시물을 찾을 수 없습니다.</h1>
        <p className="mt-4 text-gray-600">요청하신 페이지를 찾을 수 없거나, 삭제된 게시물일 수 있습니다.</p>
      </div>
    );
  }

  return (
    // [수정] div 대신 Fragment(<></>)를 사용하여 불필요한 div 래퍼를 제거합니다.
    <>
      <PostHeader post={post} />
      <PostContent content={post.content!} />
      <PostAuthorProfile post={post} />
      <PostUtilButtons post={post} prevPost={prevPost} nextPost={nextPost} />
      {/* [추가] CommentsSection을 이곳에서 렌더링합니다. */}
      <CommentsSection postId={postId} />
    </>
  );
}