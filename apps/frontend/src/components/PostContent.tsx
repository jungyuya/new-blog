// 파일 위치: apps/frontend/src/components/PostContent.tsx
'use client';

import MarkdownViewer from './MarkdownViewer';
import { useTheme } from 'next-themes'; // [추가]
import { useState, useEffect } from 'react'; // [추가]
import type { Heading } from '@/utils/toc'; // [신규] Heading 타입 import


interface PostContentProps {
  content: string;
  headings: Heading[];
}

export default function PostContent({ content, headings }: PostContentProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const articleClassName = `
    prose max-w-none 
    lg:prose-xl 
    
    /* 모든 카드 관련 스타일(배경, 그림자, 둥근 모서리, 패딩)을 sm: 접두사로 감싸
       데스크탑에서만 적용되도록 합니다. */
    px-4 
    sm:bg-white sm:rounded-lg sm:shadow-md 
    sm:p-6 md:p-8 
    
    dark:sm:bg-stone-800 dark:sm:border dark:sm:border-gray-900
    ${theme === 'dark' && mounted ? 'toastui-editor-dark' : ''}
  `;

  return (
    <article className={articleClassName}>
      {content && <MarkdownViewer content={content} headings={headings} />}
    </article>
  );
}