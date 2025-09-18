// 파일 위치: apps/frontend/src/components/PostAuthorProfile.tsx
'use client';

import { Post } from '@/utils/api';
import Image from 'next/image';

interface PostAuthorProfileProps {
  post: Post;
}

export default function PostAuthorProfile({ post }: PostAuthorProfileProps) {
  if (!post.authorId || !post.authorNickname) {
    return null;
  }

  return (
    // [수정] p-4, sm:p-6으로 여백 조정. flex-col, sm:flex-row로 레이아웃 조정
    <div className="mt-16 mb-8 p-4 sm:p-6 bg-gray-50 rounded-lg flex flex-col items-start sm:items-center sm:flex-row gap-6 dark:bg-stone-800 dark:border dark:border-gray-800">
      <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 dark:bg-gray-700">
        <Image
          src={post.authorAvatarUrl || '/default-avatar.png'}
          alt={post.authorNickname}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
      
      <div className="flex flex-col">
        <span className="text-sm text-gray-600 dark:text-gray-400">Written by</span>
        {/* [수정] 모바일에서는 text-xl, sm 사이즈 이상에서 text-2xl로 닉네임 크기 조정 */}
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 dark:text-gray-100">
          {post.authorNickname}
        </h3>
        {post.authorBio && (
          <p className="mt-2 text-gray-700 dark:text-gray-300">{post.authorBio}</p>
        )}
      </div>
    </div>
  );
}