// 파일 위치: apps/frontend/src/components/MainLayout.tsx (신규 생성)
'use client';

import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTopButton from '@/components/BackToTopButton';
import Providers from '@/app/providers'; // providers 경로 수정 필요 시 확인

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isArchitecturePage = pathname === '/architecture';

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
      </Providers>
      <BackToTopButton />
    </div>
  );
}