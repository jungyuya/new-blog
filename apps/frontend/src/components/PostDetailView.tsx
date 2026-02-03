// 파일 위치: apps/frontend/src/components/PostDetailView.tsx
'use client';

import { Post, AdjacentPost } from '@/utils/api';
import PostHeader from './PostHeader';
import PostContent from './PostContent';
import { Heading } from '@/utils/toc';
import PostUtilButtons from './PostUtilButtons';
import PostAuthorProfile from './PostAuthorProfile';
import dynamic from 'next/dynamic'; // [추가]
import { useState, useEffect, } from 'react';
import TableOfContents from './TableOfContents';


// CommentsSection을 동적으로 import 합니다.
const CommentsSection = dynamic(
  () => import('@/components/comments/CommentsSection'),
  {
    ssr: false,
    loading: () => (
      <div className="py-8 mt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="mt-4 py-4 text-center text-gray-500 dark:text-gray-400">
          댓글을 불러오는 중...
        </div>
      </div>
    ),
  }
);

interface PostDetailViewProps {
  post: Post | null;
  prevPost: AdjacentPost | null;
  nextPost: AdjacentPost | null;
  postId: string;
  headings: Heading[];
}

export default function PostDetailView({ post, prevPost, nextPost, postId, headings }: PostDetailViewProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;

    // 현재 화면에 보이는 헤딩들을 추적하는 Map
    const visibleHeadings = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 가시성 상태 업데이트
          if (entry.isIntersecting) {
            visibleHeadings.set(entry.target.id, entry);
          } else {
            visibleHeadings.delete(entry.target.id);
          }
        });

        // 화면에 보이는 헤딩이 있다면, 가장 위에 있는 것을 활성화
        if (visibleHeadings.size > 0) {
          // y 좌표(top) 기준으로 정렬하여 가장 위에 있는 헤딩 찾기
          const sortedVisible = Array.from(visibleHeadings.values()).sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          setActiveId(sortedVisible[0].target.id);
        } else {
          // 화면에 보이는 헤딩이 없을 때의 처리 (선택적)
          // 스크롤 방향에 따라 직전 헤딩을 유지하는 것이 자연스러움 -> 상태 유지
        }
      },
      {
        // 헤더 높이 등을 고려하여 상단 영역을 감지 영역으로 설정
        // top: -100px (헤더 여유), bottom: -60% (화면 하단 무시)
        rootMargin: '-100px 0px -60% 0px',
        threshold: [0, 1] // 조금이라도 보이면 감지
      }
    );

    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  if (!post) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">게시물을 찾을 수 없습니다.</h1>
        <p className="mt-4 text-gray-600">요청하신 페이지를 찾을 수 없거나, 삭제된 게시물일 수 있습니다.</p>
      </div>
    );
  }

  return (
    // Set a CSS variable that matches `max-w-5xl` (64rem) so the TOC can be positioned
    <div className="relative" style={{ '--content-max-w': '64rem' }}>


      {/* 1) 메인 콘텐츠: 가운데 정렬 (mx-auto) + 콘텐츠 최대 너비를 CSS 변수로 제어 */}
      <main className="mx-auto w-full max-w-[var(--content-max-w)] sm:px-4">
        <PostHeader post={post} />
        <PostContent content={post.content!} headings={headings} />
        <PostAuthorProfile post={post} />
        <PostUtilButtons post={post} prevPost={prevPost} nextPost={nextPost} />
        <CommentsSection postId={postId} />
      </main>


      {/* 2) 떠다니는 목차: 화면 우측에서 게시글 바로 옆에 고정
          - lg 이상에서만 보여주며, 게시글의 중앙 정렬에 영향을 주지 않도록 flow에서 분리(fixed)
          - left 계산식: 50% + (콘텐츠 최대너비 / 2) + 간격(1rem)
      */}
      {headings.length > 0 && post.showToc !== false && (
        <aside
          className="hidden lg:block"
          style={{
            position: 'fixed',
            left: 'calc(50% + (var(--content-max-w) / 2) + 1rem)',
            top: '6rem', // 원하는 stick 위치
            width: '18rem', // tailwind의 w-72 == 18rem
            maxWidth: '18rem',
          }}
        >
          <div>
            <TableOfContents headings={headings} activeId={activeId} />
          </div>
        </aside>
      )}


    </div>
  );
}