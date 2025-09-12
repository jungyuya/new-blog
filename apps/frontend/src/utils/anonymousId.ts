// 파일 위치: apps/frontend/src/utils/anonymousId.ts (신규 생성)

import { v4 as uuidv4 } from 'uuid';

const ANONYMOUS_ID_KEY = 'blog-anonymous-id';

/**
 * localStorage에서 익명 ID를 가져오거나, 없으면 새로 생성하여 저장하고 반환합니다.
 * 이 함수는 브라우저 환경에서만 실행되어야 합니다. (window 객체 사용)
 * @returns {string} 사용자의 고유 익명 ID
 */
export function getAnonymousId(): string {
  // 서버 사이드 렌더링(SSR) 중에는 window 객체가 없으므로,
  // localStorage에 접근하기 전에 반드시 브라우저 환경인지 확인합니다.
  if (typeof window === 'undefined') {
    // 서버 환경에서는 ID를 생성하거나 반환할 수 없으므로 빈 문자열을 반환합니다.
    // 실제 ID는 클라이언트 사이드에서만 필요합니다.
    return '';
  }

  let anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY);

  if (!anonymousId) {
    // localStorage에 ID가 없으면, 새로운 UUID를 생성합니다.
    anonymousId = uuidv4();
    // 생성된 ID를 localStorage에 저장하여 다음 방문 시에도 재사용할 수 있도록 합니다.
    localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
  }

  return anonymousId;
}