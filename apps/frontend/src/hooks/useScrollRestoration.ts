// 파일 위치: apps/frontend/src/hooks/useScrollRestoration.ts
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ScrollState {
  scrollY: number;
  size: number; // useSWRInfinite의 size
}

export function useScrollRestoration(
  storageKey: string,
  size: number,
  isReady: boolean // 데이터 로딩이 완료되었는지 여부
) {
  const router = useRouter();
  const shouldRestore = useRef(false);

  // 1. 페이지 이동 시 스크롤 위치와 size 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      const scrollState: ScrollState = {
        scrollY: window.scrollY,
        size: size,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(scrollState));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [storageKey, size]);

  // 2. '뒤로 가기'로 돌아왔는지 확인
  useEffect(() => {
    // popstate 이벤트는 브라우저의 '뒤로/앞으로 가기' 버튼으로 이동했을 때 발생
    const handlePopState = () => {
      shouldRestore.current = true;
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 3. 실제 복원 로직
  useEffect(() => {
    if (shouldRestore.current && isReady) {
      const savedStateJSON = sessionStorage.getItem(storageKey);
      if (savedStateJSON) {
        const savedState: ScrollState = JSON.parse(savedStateJSON);
        // 저장된 위치로 스크롤 이동
        window.scrollTo({ top: savedState.scrollY, behavior: 'auto' });
      }
      shouldRestore.current = false; // 복원 후 플래그 초기화
    }
  }, [isReady, storageKey, router]); // isReady가 true가 되면 복원 시도
}