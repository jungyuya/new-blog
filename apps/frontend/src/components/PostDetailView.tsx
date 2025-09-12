// 파일 위치: apps/frontend/src/components/PostDetailView.tsx (v2.2 - props 전달 수정)
'use client';

import { Post, AdjacentPost } from '@/utils/api'; // [수정] AdjacentPost import
import PostHeader from './PostHeader';
import PostContent from './PostContent';
import PostUtilButtons from './PostUtilButtons'; 
import PostAuthorProfile from './PostAuthorProfile';

// [수정] 컴포넌트가 받을 props 타입에 prevPost와 nextPost를 추가합니다.
interface PostDetailViewProps {
  post: Post | null;
  prevPost: AdjacentPost | null;
  nextPost: AdjacentPost | null;
}

// [수정] props에서 prevPost와 nextPost를 받도록 합니다.
export default function PostDetailView({ post, prevPost, nextPost }: PostDetailViewProps) {

  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">게시물을 찾을 수 없습니다.</h1>
        <p className="mt-4 text-gray-600">요청하신 페이지를 찾을 수 없거나, 삭제된 게시물일 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <PostHeader post={post} />
      <PostContent content={post.content!} />
      <PostAuthorProfile post={post} />
      <PostUtilButtons post={post} prevPost={prevPost} nextPost={nextPost} />
    </div>
  );
}