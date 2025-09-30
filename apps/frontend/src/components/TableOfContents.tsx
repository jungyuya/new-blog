'use client';

import type { Heading } from '@/utils/toc';
import { useState, useEffect } from 'react';

interface TocRendererProps {
  headings: Heading[];
  activeId: string;
}

export default function TableOfContents({ headings, activeId }: TocRendererProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || headings.length === 0) {
    return null;
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });

      // 클릭 피드백 애니메이션
      element.style.transition = 'background-color 0.3s ease';
      element.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
      setTimeout(() => {
        element.style.backgroundColor = 'transparent';
      }, 800);
    }
  };

  const activeIndex = headings.findIndex(h => h.id === activeId);
  const readingProgress = activeIndex >= 0 
    ? Math.round((activeIndex + 1) / headings.length * 100) 
    : 0;
  
  // [수정] 헤딩 레벨에 따른 스타일을 반환하는 헬퍼 함수
  const getHeadingStyles = (level: number) => {
    switch (level) {
      case 1:
        return 'font-bold text-[20px]'; // H1: 20px, bold
      case 2:
        return 'font-normal text-[16px]'; // H2: 16px
      case 3:
        return 'font-normal text-[14px]'; // H3: 14px
      case 4:
        return 'font-light text-[13px]'; // H4: 13px
      default:
        return 'font-light text-xs';
    }
  };

  return (
    <nav className="toc-container">
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* [중요] Bullet point 제거 */
        .toc-container ul,
        .toc-container ul li,
        .toc-container li::before,
        .toc-container li::marker {
          list-style: none !important;
          list-style-type: none !important;
          content: none !important;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .toc-container {
          animation: slideIn 0.4s ease-out;
        }

        .toc-container ul {
         list-style: none;
        }

        .toc-item {
          animation: slideIn 0.4s ease-out backwards;
        }

        .progress-ring {
          transition: stroke-dashoffset 0.3s ease;
        }

        .toc-link::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          background: currentColor;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.3s ease;
        }

        .toc-link.active::before {
          opacity: 1;
          width: 6px;
          height: 6px;
          animation: pulse 2s infinite;
        }

        .level-indicator {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, transparent, #6366f1, transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .toc-item:hover .level-indicator {
          opacity: 0.3;
        }

        .section-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          background: rgba(99, 102, 241, 0.08);
          color: rgba(99, 102, 241, 0.7);
          margin-right: 8px;
        }
      `}</style>

      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              목차
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {headings.length}개 섹션
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
          aria-label={isExpanded ? "목차 접기" : "목차 펼치기"}
        >
          <svg 
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${
              isExpanded ? 'rotate-0' : 'rotate-180'
            }`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 목차 리스트 */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <ul className="space-y-0.5 pl-6" style={{ listStyle: 'none' }}>
            {headings.map(({ id, level, text }, index) => {
            const isActive = activeId === id;
            
            return (
                <li
                key={`${id}-${index}`}
                className="toc-item relative group"
                style={{ 
                    // H1(level 1)은 0이 되어 ul의 패딩을 그대로 사용하고, H2부터 들여쓰기가 추가됩니다.
                    paddingLeft: `${(level - 1) * 1.2}rem`,
                    animationDelay: `${index * 0.03}s`,
                    listStyle: 'none'
                }}
                >
                <a
                    href={`#${id}`}
                    onClick={(e) => handleLinkClick(e, id)}
                    className={`
                    toc-link relative block py-2 px-3 rounded-lg transition-all duration-200
                    ${isActive
                        ? 'active bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }
                    ${level === 1 ? 'font-bold text-[20px]' : level === 2 ? 'text-[16px]' : 'text-sm font-light'}
                    `}
                >
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 line-clamp-1">
                      {text}
                    </span>
                    
                    {isActive && (
                      <svg className="w-3 h-3 text-indigo-500 dark:text-indigo-400 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* 호버 시 나타나는 섹션 번호 */}
                  {/* [수정] 호버 번호 위치 조정: -left-6 -> -left-5 */}
                  <span className="absolute -left-6 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {String(index + 1).padStart(2, '0')}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}