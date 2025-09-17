// 파일 위치: apps/frontend/src/components/PostContent.tsx
'use client';

import MarkdownViewer from './MarkdownViewer';
import { useTheme } from 'next-themes'; // [추가]
import { useState, useEffect } from 'react'; // [추가]

interface PostContentProps {
  content: string;
}

export default function PostContent({ content }: PostContentProps) {
  const { theme } = useTheme(); // [추가]
  const [mounted, setMounted] = useState(false); // [추가]

  useEffect(() => { // [추가]
    setMounted(true);
  }, []);

  // [수정] 다크 모드일 때 'toastui-editor-dark' 클래스를 동적으로 추가합니다.
  const articleClassName = `
    prose lg:prose-xl max-w-none 
    bg-white rounded-lg shadow-md p-6 md:p-8
    dark:bg-stone-800 dark:border dark:border-gray-900
    ${theme === 'dark' && mounted ? 'toastui-editor-dark' : ''}
  `;

  return (
    <article className={articleClassName}>
      {content && <MarkdownViewer content={content} />}
    </article>
  );
}