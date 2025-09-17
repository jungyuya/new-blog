// apps/frontend/src/components/AuthLayout.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // [추가] 1. 전체 화면을 차지하고, 자식을 중앙 정렬하는 배경 레이아웃
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* 로고와 제목 */}
        <Link href="/" className="flex items-center justify-center space-x-2">
          <Image src="/homelogo.webp" alt="로고" width={32} height={32} unoptimized={true} />
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Deep Dive!
          </h2>
        </Link>
      </div>

      {/* [추가] 2. 폼을 감싸는 카드 UI (PostCard 등과 유사한 스타일) */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 dark:bg-stone-800 dark:border dark:border-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}