// 파일 위치: apps/frontend/src/components/Footer.tsx
'use client';

import React from 'react';

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

export default function Footer() {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;
  const homeUrl = "https://jungyu.store";

  return (
    // [수정] 1. footer 배경 및 상단 테두리에 다크 모드 스타일 적용 (Header와 동일한 규칙)
    <footer className="bg-gray-50 border-t border-gray-100 dark:bg-stone-950 dark:border-t dark:border-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        
        <div className="invisible flex items-center space-x-4" aria-hidden="true">
          <a href="#"><HomeIcon /></a>
          <a href="#"><GitHubIcon /></a>
        </div>

        {/* [수정] 2. 저작권 텍스트에 다크 모드 색상 적용 */}
        <div className="text-sm text-gray-100 text-center dark:text-gray-300">
          © {new Date().getFullYear()} LEE JUNGYU. All Rights Reserved.
        </div>

        <div className="flex items-center space-x-4">
          {homeUrl && (
            <a
              href={homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              // [수정] 3. 아이콘 링크에 다크 모드 색상 및 hover 효과 적용
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-white"
              aria-label="Visit my personal website"
            >
              <HomeIcon />
            </a>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              // [수정] 3. 아이콘 링크에 다크 모드 색상 및 hover 효과 적용
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-white"
              aria-label="Visit my GitHub profile"
            >
              <GitHubIcon />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}