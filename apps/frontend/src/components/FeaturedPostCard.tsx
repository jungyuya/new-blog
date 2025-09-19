// 파일 위치: apps/frontend/src/components/FeaturedPostCard.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Post } from '@/utils/api';

interface FeaturedPostCardProps {
  post: Post;
}

export default function FeaturedPostCard({ post }: FeaturedPostCardProps) {
  const thumbnailUrl = post.thumbnailUrl || '/default-thumbnail.webp';

  return (
    // [수정] 전체를 감싸는 Link와 내부 구조를 목표 디자인에 맞게 변경
    <Link
      href={`/posts/${post.postId}`}
      className="group relative block w-full aspect-video md:aspect-[2.4/1] overflow-hidden rounded-lg shadow-lg"
    >
      {/* 1. 배경 이미지 */}
      <Image
        src={thumbnailUrl}
        alt={post.title}
        fill
        className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
        sizes="100vw"
        priority
        unoptimized={true}
      />
      {/* 2. 어두운 오버레이 (텍스트 가독성 확보) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>

      {/* 3. 텍스트 콘텐츠 */}
      <div className="absolute bottom-0 left-0 p-6 md:p-8 lg:p-12 text-white w-full md:w-3/5 lg:w-1/2">
        <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">
          {post.title}
        </h3>
        <p className="text-sm md:text-base text-gray-300 mb-6 line-clamp-2 md:line-clamp-3">
          {post.summary || '요약 정보가 없습니다.'}
        </p>
        <div className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 group-hover:pl-5">
          Read More
          <svg className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
        </div>
      </div>
    </Link>
  );
}