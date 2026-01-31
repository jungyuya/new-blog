// 파일 위치: apps/frontend/src/components/MainLayout.tsx
'use client';

import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTopButton from '@/components/BackToTopButton';
import Providers from '@/app/providers';
import ChatWidget from '@/components/ChatWidget';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isArchitecturePage = pathname === '/architecture';
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  // 로그인/회원가입 페이지인 경우 헤더와 챗봇 위젯은 유지하고 푸터와 너비 제한만 제거
  // [수정] overflow-hidden을 제거하여 기기별 호환성(스크롤) 확보
  if (isAuthPage) {
    return (
      <Providers>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow w-full relative">
            {children}
          </main>
          <ChatWidget />
        </div>
      </Providers>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Providers>
        <Header />
        <main className={
          isArchitecturePage
            ? "flex-grow w-full"
            : "flex-grow max-w-7xl mx-auto px-6 py-8 w-full"
        }>
          {children}
        </main>
        <Footer />
        <ChatWidget />
      </Providers>
      <BackToTopButton />
    </div>
  );
}