// 파일 위치: apps/frontend/src/hooks/useIntersectionObserver.ts
'use client';

import { useEffect, useState } from 'react';

// 훅의 옵션 타입을 정의합니다.
interface IntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
}

/**
 * Intersection Observer API를 쉽게 사용할 수 있도록 만든 커스텀 훅입니다.
 * @param options - threshold, root, rootMargin 등 Observer 옵션
 * @returns [setTarget, entry] - 관찰할 요소를 설정하는 함수와, IntersectionObserverEntry 객체
 */
export function useIntersectionObserver(options?: IntersectionObserverOptions) {
  // 관찰 대상이 되는 DOM 요소를 저장할 ref
  const [target, setTarget] = useState<Element | null>(null);
  
  // IntersectionObserverEntry 객체를 저장할 state
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  // 옵션이 변경될 때마다 Observer를 재생성하기 위해, 옵션을 문자열로 변환하여 useEffect의 의존성 배열에 사용합니다.
  const optionsString = JSON.stringify(options);

  useEffect(() => {
    // 관찰 대상이 없으면 아무것도 하지 않습니다.
    if (!target) return;

    // Intersection Observer 인스턴스를 생성합니다.
    const observer = new IntersectionObserver(
      ([entry]) => {
        // 관찰된 entry를 state에 업데이트합니다.
        setEntry(entry);
      },
      { ...options }
    );

    // 관찰을 시작합니다.
    observer.observe(target);

    // 컴포넌트가 언마운트되거나, target 또는 옵션이 변경될 때 관찰을 중지합니다.
    return () => {
      observer.unobserve(target);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, optionsString]); // target이나 옵션이 변경되면 useEffect를 다시 실행합니다.

  return { setTarget, entry };
}