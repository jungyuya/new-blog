// 파일 위치: apps/frontend/src/components/PostContent.tsx
'use client';

import MarkdownViewer from './MarkdownViewer';

interface PostContentProps {
  content: string;
}

export default function PostContent({ content }: PostContentProps) {
  return (
    // [수정] prose 스타일과 함께 카드 디자인을 위한 Tailwind 클래스를 추가합니다.
    <article 
      className="
        prose lg:prose-xl max-w-none 
        bg-white rounded-lg shadow-md p-6 md:p-8
        dark:bg-slate-300 dark:border dark:border-slate-300
      "
    >
      {content && <MarkdownViewer content={content} />}
    </article>
  );
}