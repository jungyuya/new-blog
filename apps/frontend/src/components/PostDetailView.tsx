// 파일 위치: apps/frontend/src/components/PostDetailView.tsx (v2.1 - 유틸리티 버튼 적용)
'use client';

import { Post } from '@/utils/api';

import PostHeader from './PostHeader';
import PostContent from './PostContent';
// [수정] PostFooter 대신 PostUtilButtons를 import 합니다.
import PostUtilButtons from './PostUtilButtons'; 
import PostAuthorProfile from './PostAuthorProfile';


interface PostDetailViewProps {
  post: Post | null;
}

export default function PostDetailView({ post }: PostDetailViewProps) {

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

      {/* --- [핵심 수정] PostFooter를 PostUtilButtons로 교체합니다. --- */}
      {/* PostUtilButtons는 postId prop이 필요 없으므로 전달하지 않습니다. */}
      <PostUtilButtons />
    </div>
  );
}