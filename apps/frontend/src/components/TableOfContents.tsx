'use client';

import type { Heading } from '@/utils/toc';
import { useState, useEffect, useCallback, useMemo } from 'react';

interface TocRendererProps {
  headings: Heading[];
  activeId: string;
}

export default function TableOfContents({ headings, activeId }: TocRendererProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // 기본값을 true로 변경 (더 나은 UX)
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isCompact, setIsCompact] = useState(false); // 컴팩트 모드 추가

  useEffect(() => {
    setIsMounted(true);
    
    // 스크롤 진행도 계산
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min((scrollTop / docHeight) * 100, 100);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 활성 섹션 인덱스 계산
  const activeIndex = useMemo(() => {
    return headings.findIndex(h => h.id === activeId);
  }, [headings, activeId]);

  // 읽기 진행률 계산
  const readingProgress = useMemo(() => {
    return activeIndex >= 0 
      ? Math.round((activeIndex + 1) / headings.length * 100) 
      : 0;
  }, [activeIndex, headings.length]);

  // 부드러운 스크롤 핸들러
  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });

      // 클릭 피드백 애니메이션 (향상된 버전)
      element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      element.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
      element.style.transform = 'scale(1.02)';
      
      setTimeout(() => {
        element.style.backgroundColor = 'transparent';
        element.style.transform = 'scale(1)';
      }, 800);
    }
  }, []);

  // 헤딩 레벨에 따른 스타일 반환
  const getHeadingStyles = useCallback((level: number, isActive: boolean) => {
    const baseStyles = {
      1: 'font-bold text-[18px]', // H1
      2: 'font-medium text-[15px]', // H2
      3: 'font-normal text-[13px]', // H3
      4: 'font-light text-[12px]', // H4
    };

    // 컴팩트 모드일 때는 크기를 줄임
    const compactStyles = {
      1: 'font-semibold text-[14px]',
      2: 'font-medium text-[12px]',
      3: 'font-normal text-[11px]',
      4: 'font-light text-[10px]',
    };

    const styles = isCompact ? compactStyles : baseStyles;
    return styles[level as keyof typeof styles] || 'font-light text-xs';
  }, [isCompact]);

  // 섹션 그룹화 (H1 기준으로 그룹 생성)
  const groupedHeadings = useMemo(() => {
    const groups: { title: Heading; items: Heading[] }[] = [];
    let currentGroup: { title: Heading; items: Heading[] } | null = null;

    headings.forEach((heading) => {
      if (heading.level === 1) {
        currentGroup = { title: heading, items: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.items.push(heading);
      }
    });

    return groups;
  }, [headings]);

  if (!isMounted || headings.length === 0) {
    return null;
  }

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

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Bullet point 제거 */
        .toc-container ul,
        .toc-container li {
          list-style: none !important;
          list-style-type: none !important;
        }

        .toc-container {
          animation: slideIn 0.4s ease-out;
        }

        .toc-item {
          animation: fadeIn 0.3s ease-out backwards;
        }

        .progress-bar {
          background: linear-gradient(
            90deg,
            #6366f1 0%,
            #8b5cf6 50%,
            #6366f1 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }

        .toc-link {
          position: relative;
          overflow: hidden;
        }

        /* 향상된 인디케이터 */
        .toc-link::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 3px;
          background: currentColor;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toc-link.active::before {
          opacity: 1;
          width: 8px;
          height: 8px;
          animation: pulse 2s infinite;
        }

        /* 호버 이펙트 */
        .toc-link::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(99, 102, 241, 0.05),
            transparent
          );
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }

        .toc-link:hover::after {
          transform: translateX(100%);
        }

        /* 섹션 구분선 애니메이션 */
        .section-divider {
          position: relative;
          overflow: hidden;
        }

        .section-divider::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(99, 102, 241, 0.3),
            transparent
          );
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .section-divider:hover::after {
          transform: scaleX(1);
        }

        /* 컴팩트 모드 트랜지션 */
        .compact-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* 스크롤 프로그레스 그라데이션 */
        .scroll-gradient {
          background: linear-gradient(
            to right,
            #6366f1,
            #8b5cf6
          );
        }
      `}</style>

      {/* 헤더 섹션 - 향상된 디자인 */}
      <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 아이콘 컨테이너 - 애니메이션 추가 */}
            <div className="relative p-2 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                목차
                {/* 읽기 진행률 배지 */}
                {readingProgress > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {readingProgress}% 읽음
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {headings.length}개 섹션 • {groupedHeadings.length}개 챕터
              </p>
            </div>
          </div>

          {/* 컨트롤 버튼 그룹 */}
          <div className="flex items-center gap-1">
            {/* 컴팩트 모드 토글 */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
              aria-label={isCompact ? "일반 모드" : "컴팩트 모드"}
              title={isCompact ? "일반 모드로 전환" : "컴팩트 모드로 전환"}
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isCompact ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                )}
              </svg>
            </button>

            {/* 펼치기/접기 버튼 */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
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
        </div>

        {/* 전체 스크롤 진행 바 */}
        <div className="relative w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="progress-bar h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </div>

      {/* 목차 리스트 - 향상된 애니메이션 */}
      <div className={`compact-transition transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <ul className={`space-y-0.5 ${isCompact ? 'pl-4' : 'pl-6'}`}>
          {headings.map(({ id, level, text }, index) => {
            const isActive = activeId === id;
            const isHovered = hoveredId === id;
            const isNextActive = index > 0 && headings[index - 1]?.id === activeId;
            const isPrevActive = index < headings.length - 1 && headings[index + 1]?.id === activeId;
            
            return (
              <li
                key={`${id}-${index}`}
                className="toc-item relative group"
                style={{ 
                  paddingLeft: `${(level - 1) * (isCompact ? 0.8 : 1.2)}rem`,
                  animationDelay: `${index * 0.03}s`,
                }}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* H1 섹션 구분선 */}
                {level === 1 && index > 0 && (
                  <div className="section-divider absolute -top-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                )}

                <a
                  href={`#${id}`}
                  onClick={(e) => handleLinkClick(e, id)}
                  className={`
                    toc-link relative block ${isCompact ? 'py-1.5 px-2' : 'py-2 px-3'} rounded-lg transition-all duration-200
                    ${isActive
                      ? 'active bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-800/50'
                      : isNextActive || isPrevActive
                      ? 'text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-800/30'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }
                    ${getHeadingStyles(level, isActive)}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 line-clamp-1 flex items-center gap-2">
                      {/* H1에 아이콘 추가 (선택적) */}
                      {level === 1 && !isCompact && (
                        <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v8H5V6z" clipRule="evenodd" />
                        </svg>
                      )}
                      {text}
                    </span>
                    
                    {/* 활성 상태 인디케이터 */}
                    {isActive && (
                      <div className="flex items-center gap-1 ml-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse" />
                        <svg className="w-3 h-3 text-indigo-500 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}

                    {/* 호버 시 화살표 (선택적) */}
                    {isHovered && !isActive && (
                      <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>

                  {/* 섹션 번호 (호버 시) */}
                  <span className={`absolute ${isCompact ? '-left-4' : '-left-5'} top-1/2 transform -translate-y-1/2 text-xs font-mono text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* 레벨 인디케이터 (선택적 - 성능 고려하여 주석처리 가능) */}
                  {/* <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-indigo-300 to-transparent opacity-0 group-hover:opacity-30 transition-opacity`} /> */}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 빠른 네비게이션 (선택적 - 너무 복잡하면 제거 가능) */}
      {isExpanded && headings.length > 10 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <button
              onClick={(e) => handleLinkClick(e, headings[0].id)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              처음으로
            </button>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <button
              onClick={(e) => handleLinkClick(e, headings[headings.length - 1].id)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              끝으로
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}