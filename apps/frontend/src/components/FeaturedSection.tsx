// 파일 위치: apps/frontend/src/components/FeaturedSection.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Post } from '@/utils/api';
import FeaturedPostCard from './FeaturedPostCard';
import PostCard from './PostCard';
import TagFilter from './TagFilter';
import { ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-react';

interface FeaturedSectionProps {
  heroPost: Post | null;
  editorPicks: Post[];
}

export default function FeaturedSection({ heroPost, editorPicks }: FeaturedSectionProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    duration: 30,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!heroPost && editorPicks.length === 0) return null;

  const showCarousel = editorPicks.length > 4;

  return (
    <div className="mb-16">
      {heroPost && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">🏆 Spotlight Post</h2>
          <FeaturedPostCard post={heroPost} />
        </section>
      )}

      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">인기 태그</h2>
        <TagFilter />
      </section>

      {editorPicks.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold dark:text-gray-100">추천 게시물</h2>
          </div>

          {showCarousel ? (
            // --- [핵심 수정] 캐러셀과 버튼을 감싸는 relative group 컨테이너 추가 ---
            <div className="relative group border border-gray-200 dark:border-transparent rounded-lg p-1 bg-gray-50 dark:bg-transparent">
              <div className="embla" ref={emblaRef}>
                <div className="embla__container">
                  {editorPicks.map(post => (
                    <div className="embla__slide" key={post.postId}>
                      <PostCard post={post} isEditorPick={true} variant="compact" />
                    </div>
                  ))}
                </div>
              </div>

              {/* --- [핵심 수정] 버튼 위치 및 스타일 변경 --- */}
              <button
                onClick={scrollPrev}
                className="nav-btn absolute top-1/2 left-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 disabled:opacity-30 transition-all duration-300 hover:scale-110"
                aria-label="Previous"
              >
                <ArrowLeftIcon />
              </button>
              <button
                onClick={scrollNext}
                className="nav-btn absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 disabled:opacity-30 transition-all duration-300 hover:scale-110"
                aria-label="Next"
              >
                <ArrowRightIcon />
              </button>

              {scrollSnaps.length > 1 && (
                <div className="dots">
                  {scrollSnaps.map((_, idx) => (
                    <button
                      key={idx}
                      className={`dot ${idx === selectedIndex ? 'dot--active' : ''}`}
                      onClick={() => scrollTo(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {editorPicks.map(post => (
                <PostCard key={post.postId} post={post} isEditorPick={true} variant="compact" />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}