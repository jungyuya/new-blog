// 파일 위치: apps/frontend/src/components/PostContent.tsx
'use client';

import MarkdownViewer from './MarkdownViewer';

interface PostContentProps {
  content: string;
}

export default function PostContent({ content }: PostContentProps) {
  // [핵심 수정] article 태그에 prose 클래스를 적용하여,
  // 내부의 모든 h1, p, img 태그 등에 Tailwind Typography 스타일을 적용합니다.
  return (
    <article className="prose lg:prose-xl max-w-none">
      {content && <MarkdownViewer content={content} />}
    </article>
  );
}