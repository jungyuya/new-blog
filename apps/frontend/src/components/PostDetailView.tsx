// 파일 위치: apps/frontend/src/components/PostDetailView.tsx (v2.0 - Refactored)
'use client';

import { Post } from '@/utils/api';

// [핵심] 우리가 새로 만든 전문 컴포넌트들을 import 합니다.
import PostHeader from './PostHeader';
import PostContent from './PostContent';
import PostFooter from './PostFooter';
import PostAuthorProfile from './PostAuthorProfile'; // [추가]


// 이 컴포넌트가 받을 props 타입은 변경되지 않습니다.
interface PostDetailViewProps {
  post: Post | null;
}

/**
 * 게시물 상세 페이지의 전체 UI를 구성하는 '컨테이너' 컴포넌트입니다.
 * PostHeader, PostContent, PostFooter 등 세부 컴포넌트들을 조립하는 역할을 합니다.
 */
export default function PostDetailView({ post }: PostDetailViewProps) {

  // 게시물이 없는 경우를 위한 방어 코드 (Graceful Degradation)
  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">게시물을 찾을 수 없습니다.</h1>
        <p className="mt-4 text-gray-600">요청하신 페이지를 찾을 수 없거나, 삭제된 게시물일 수 있습니다.</p>
      </div>
    );
  }

  // 이제 이 컴포넌트는 UI 조립에만 집중합니다.
  // 복잡한 로직들은 각 하위 컴포넌트로 모두 위임되었습니다.
  return (
    <div>
      <PostHeader post={post} />
      <PostContent content={post.content!} /> {/* content가 없을 경우를 대비해 non-null assertion(!) 추가 */}

      {/* [핵심 추가] 본문과 푸터 사이에 작성자 프로필 컴포넌트를 삽입합니다. */}
      <PostAuthorProfile post={post} />

      <PostFooter postId={post.postId} />
    </div>
  );
}