// 파일 위치: apps/frontend/src/components/Footer.tsx
'use client';

import React from 'react';

import Link from 'next/link';
import { Github, Home } from 'lucide-react';

// ArchitectureIcon은 커스텀 디자인
const ArchitectureIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="6.5" cy="6.5" r="3.5" fill="rgba(0, 0, 0, 0.1)" stroke="currentColor" />
    <circle cx="17.5" cy="6.5" r="3.5" fill="rgba(0, 0, 0, 0.1)" stroke="currentColor" />

    <rect x="3" y="14" width="7" height="7" rx="1" fill="rgba(0, 0, 0, 0.1)" stroke="currentColor" />
    <rect x="14" y="14" width="7" height="7" rx="1" fill="rgba(0, 0, 0, 0.1)" stroke="currentColor" />

    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 10v3.5M17.5 10v3.5" /> {/* 세로 연결 */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 17.5h4" /> {/* 하단 가로 */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6.5h4" /> {/* 상단 가로 */}

    <path d="M6.5 13.5l-1 1 1 1" fill="none" stroke="currentColor" strokeWidth={1.5} />
    <path d="M17.5 13.5l-1 1 1 1" fill="none" stroke="currentColor" strokeWidth={1.5} />

    <line x1="2" y1="22" x2="22" y2="22" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

export default function Footer() {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;
  const homeUrl = "https://jungyu.store";

  return (
    <footer className="bg-gray-50 border-t border-gray-100 dark:bg-stone-950 dark:border-t dark:border-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">

        {/* 왼쪽 공간 확보용 div */}
        <div className="flex items-center space-x-4 invisible" aria-hidden="true">
          <a href="#"><Home className="w-6 h-6" /></a>
          <a href="#"><Github className="w-6 h-6" /></a>
          {/* [신규] 아키텍처 아이콘을 왼쪽에도 추가하여 중앙 정렬을 맞춥니다. */}
          <a href="#"><ArchitectureIcon /></a>
        </div>

        {/* 중앙 저작권 텍스트 */}
        <div className="text-sm text-gray-700 text-center dark:text-gray-300">
          © {new Date().getFullYear()} LEE JUNGYU. All Rights Reserved.
        </div>

        {/* 오른쪽 아이콘 그룹 */}
        <div className="flex items-center space-x-4">
          {/* --- 아키텍처 페이지 링크 버튼 --- */}
          <Link
            href="/architecture"
            className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-white"
            aria-label="View project architecture"
          >
            <ArchitectureIcon />
          </Link>

          {homeUrl && (
            <a
              href={homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-white"
              aria-label="Visit my personal website"
            >
              <Home className="w-5 h-5" />
            </a>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-white"
              aria-label="Visit my GitHub profile"
            >
              <Github className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}