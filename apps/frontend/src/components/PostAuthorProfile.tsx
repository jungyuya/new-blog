// 파일 위치: apps/frontend/src/components/PostAuthorProfile.tsx
'use client';

import { Post } from '@/utils/api';
import Image from 'next/image';
import Link from 'next/link';

// 이 컴포넌트가 받을 props 타입을 정의합니다.
interface PostAuthorProfileProps {
  // post 객체 전체를 받아서 필요한 작성자 정보를 추출합니다.
  post: Post;
}

/**
 * 게시물 하단에 표시되는 작성자의 프로필 박스 컴포넌트입니다.
 */
export default function PostAuthorProfile({ post }: PostAuthorProfileProps) {
  // 작성자 관련 정보가 없는 경우(오래된 데이터 등)를 대비한 방어 코드
  if (!post.authorId || !post.authorNickname) {
    return null; // 아무것도 렌더링하지 않음
  }

  return (
    <div className="mt-16 mb-8 p-6 bg-gray-50 rounded-lg flex items-start sm:items-center flex-col sm:flex-row gap-6">
      {/* 프로필 사진 */}
      {/* TODO: 나중에 작성자별 페이지가 생기면 Link로 감싸줍니다. */}
      <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
        <Image
          // [핵심] post 객체에 아직 authorAvatarUrl이 없으므로, 우선 기본 이미지를 사용합니다.
          // 백엔드에서 authorAvatarUrl을 추가하면 이 부분을 수정해야 합니다.
          src={post.authorAvatarUrl || '/default-avatar.png'}
          alt={post.authorNickname}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
      
      {/* 프로필 정보 */}
      <div className="flex flex-col">
        <span className="text-sm text-gray-600">Written by</span>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">
          {post.authorNickname}
        </h3>
        {/* authorBio가 있을 경우에만 자기소개를 표시합니다. */}
        {post.authorBio && (
          <p className="mt-2 text-gray-700">{post.authorBio}</p>
        )}
      </div>
    </div>
  );
}