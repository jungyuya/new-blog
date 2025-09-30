// 파일 위치: apps/frontend/src/utils/storage.ts

/**
 * localStorage에 안전하게 접근하기 위한 유틸리티 객체입니다.
 * 서버 사이드 렌더링 환경을 고려하여, window 객체가 있을 때만 동작합니다.
 */
export const safeLocalStorage = {
  /**
   * localStorage에서 값을 가져옵니다.
   * @param key 가져올 값의 키
   * @param defaultValue 키에 해당하는 값이 없을 경우 반환할 기본값
   * @returns 저장된 값 또는 기본값
   */
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    try {
      const storedValue = window.localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage for key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * localStorage에 값을 저장합니다.
   * @param key 저장할 값의 키
   * @param value 저장할 값
   */
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const serializedValue = JSON.stringify(value);
      window.localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error writing to localStorage for key "${key}":`, error);
    }
  },

  /**
   * localStorage에서 특정 키의 값을 삭제합니다.
   * @param key 삭제할 값의 키
   */
  remove(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage for key "${key}":`, error);
    }
  },
};