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
    // [수정] 1. 프로필 카드 컨테이너에 다크 모드 스타일 적용
    <div className="mt-16 mb-8 p-6 bg-gray-50 rounded-lg flex items-start sm:items-center flex-col sm:flex-row gap-6 dark:bg-stone-800 dark:border dark:border-gray-800">
      {/* [수정] 2. 프로필 사진 배경에 다크 모드 색상 적용 */}
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
        {/* [수정] 3. 텍스트 요소들에 다크 모드 색상 적용 */}
        <span className="text-sm text-gray-600 dark:text-gray-400">Written by</span>
        <h3 className="text-2xl font-bold text-gray-900 mt-1 dark:text-gray-100">
          {post.authorNickname}
        </h3>
        {post.authorBio && (
          <p className="mt-2 text-gray-700 dark:text-gray-300">{post.authorBio}</p>
        )}
      </div>
    </div>
  );
}