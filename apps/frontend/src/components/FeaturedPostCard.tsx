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
    <Link
      href={`/posts/${post.postId}`}
      // [수정] aspect-ratio를 유지하되, 모바일을 위한 최소 높이를 보장합니다.
      className="group relative block w-full aspect-video md:aspect-[3.2/1] min-h-[256px] sm:min-h-0 overflow-hidden rounded-lg shadow-lg"
    >
      {/* 1. 배경 이미지 (변경 없음) */}
      <Image
        src={thumbnailUrl}
        alt={post.title}
        fill
        className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
        sizes="100vw"
        priority
        unoptimized={true}
      />
      {/* 2. 어두운 오버레이 (변경 없음) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>

      {/* 3. 텍스트 콘텐츠 */}
      {/* [수정] 반응형 패딩과 텍스트 크기를 적용합니다. */}
      <div className="absolute bottom-0 left-0 p-4 sm:p-6 md:p-8 lg:p-12 text-white w-full md:w-3/5 lg:w-1/2">
        <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 line-clamp-3">
          {post.title}
        </h3>
        <p className="text-xs sm:text-sm md:text-base text-gray-300 mb-4 sm:mb-6 line-clamp-2 md:line-clamp-3">
          {post.summary || '요약 정보가 없습니다.'}
        </p>
        
        {/* [수정] 버튼 크기와 폰트 크기를 반응형으로 조정합니다. */}
        <div className="group liquid relative inline-flex items-center bg-transparent border-2 border-blue-400 text-blue-400 font-semibold py-2 px-4 sm:py-3 sm:px-8 rounded-xl transition-all duration-300 hover:text-white hover:border-blue-400 text-sm sm:text-base">
          <span className="relative z-10 flex items-center">
            Read More
            <svg className="ml-2 w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}