// apps/frontend/src/components/AuthLayout.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // [수정] fixed 대신 relative와 min-h-screen을 사용하여 스크롤 이슈 해결
    <div className="relative w-full min-h-[calc(100vh-60px)] flex items-center justify-center select-none py-12 px-4">
      {/* 배경 이미지 레이어 - 테마에 따라 이미지 교체 */}
      <div className="fixed inset-0 z-[-1] scale-105 blur-[1px]">
        {/* 라이트 모드 배경 */}
        <div className="dark:hidden absolute inset-0">
          <Image
            src="/auth-bg.webp"
            alt="Auth Background Light"
            fill
            className="object-cover"
            priority
            unoptimized={true}
          />
        </div>
        {/* 다크 모드 배경 */}
        <div className="hidden dark:block absolute inset-0">
          <Image
            src="/auth-bg2.webp"
            alt="Auth Background Dark"
            fill
            className="object-cover"
            priority
            unoptimized={true}
          />
        </div>
        {/* 고도화된 다크 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/20 to-transparent backdrop-brightness-90 dark:backdrop-brightness-75"></div>
      </div>

      {/* 콘텐츠 레이어 */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* 로고와 제목 */}
          <Link href="/" className="flex flex-col items-center justify-center space-y-4 group">
            <div className="p-4 bg-white/10 rounded-[2.5rem] backdrop-blur-xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 group-hover:border-white/40">
              <Image src="/homelogo.webp" alt="로고" width={56} height={56} unoptimized={true} />
            </div>
            <div className="text-center space-y-1">
              {/* [수정] 라이트 모드에서도 흰색 계열 유지 */}
              <h2 className="text-4xl font-black tracking-tighter text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                DEEP DIVE
              </h2>
              <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full transition-all duration-500 group-hover:w-20"></div>
              <p className="text-blue-100/70 text-[10px] font-bold tracking-[0.3em] uppercase mt-2">Personal Portal Terminal</p>
            </div>
          </Link>
        </div>

        {/* Glassmorphism 카드 UI */}
        <div className="mt-10">
          <div className="bg-black/40 py-10 px-6 backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-[2rem] sm:px-12 relative overflow-hidden group">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[80px] pointer-events-none"></div>

            <div className="relative z-10">
              {children}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-white/30 text-[10px] font-medium tracking-widest uppercase">
          Authorized personnel only © 2026 Portal
        </p>
      </div>
    </div>
  );
}