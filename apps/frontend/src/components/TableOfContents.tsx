// 파일 위치: apps/frontend/src/components/TableOfContents.tsx

'use client';

import type { Heading } from '@/utils/toc';
import { useState, useEffect } from 'react';

interface TocRendererProps {
  headings: Heading[];
  activeId: string;
}

export default function TableOfContents({ headings, activeId }: TocRendererProps) {
  // 클라이언트 사이드에서만 렌더링되도록 마운트 상태를 확인합니다.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || headings.length === 0) {
    return null; // 마운트 전이거나 목차 항목이 없으면 아무것도 렌더링하지 않음
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80, // 헤더 높이 등을 고려하여 약간의 오프셋을 줍니다.
        behavior: 'smooth',
      });
    }
  };

  return (
    <nav>
      <ul className="space-y-2">
        {headings.map(({ id, level, text }, index) => (
          <li
            key={`${id}-${index}`} // id와 index를 조합하여 항상 고유한 key를 보장
            style={{ paddingLeft: `${(level - 1) * 1.5 + 0.5}rem` }}
          >
            <a
              href={`#${id}`}
              onClick={(e) => handleLinkClick(e, id)}
              className={`
                block text-sm transition-colors duration-200
                ${activeId === id
                  ? 'text-indigo-500 font-semibold'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}