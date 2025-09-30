// 파일 위치: apps/frontend/src/hooks/useAutosave.ts

import { useEffect, useRef } from 'react';
import { safeLocalStorage } from '@/utils/storage';

// 자동 저장될 데이터의 형태를 정의합니다.
export interface AutosaveData {
  title: string;
  content: string;
}

const AUTOSAVE_KEY = 'post-autosave';

/**
 * 글 작성 폼의 내용을 주기적으로 localStorage에 자동 저장하는 훅입니다.
 * @param data 저장할 데이터 (예: { title, content })
 * @param delay 디바운싱 지연 시간 (밀리초 단위)
 */
export function useAutosave(data: AutosaveData, delay = 2000) {
  // useRef를 사용하여 data의 최신 값을 항상 참조하도록 합니다.
  // 이렇게 하면 useEffect의 의존성 배열에 data를 넣지 않아도 되어, 불필요한 재실행을 방지할 수 있습니다.
  const savedData = useRef(data);
  savedData.current = data;

  useEffect(() => {
    // 디바운싱을 위한 타이머 ID
    let timeoutId: NodeJS.Timeout;

    const save = () => {
      // 제목이나 내용 중 하나라도 있어야 저장합니다.
      if (savedData.current.title.trim() || savedData.current.content.trim()) {
        console.log('Autosaving content...', savedData.current);
        safeLocalStorage.set(AUTOSAVE_KEY, savedData.current);
      }
    };

    // 디바운스된 저장 함수
    const debouncedSave = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(save, delay);
    };

    // data가 변경될 때마다 디바운스된 저장 함수를 호출합니다.
    // 실제 저장은 delay 시간 이후에 한 번만 실행됩니다.
    debouncedSave();

    // 컴포넌트가 언마운트될 때 타이머를 정리합니다.
    return () => {
      clearTimeout(timeoutId);
    };
  }, [data, delay]); // data가 변경될 때마다 이 effect가 재실행됩니다.
}

/**
 * 저장된 자동 저장 데이터를 불러오고 삭제하는 유틸리티 함수들을 제공합니다.
 */
export const autosaveManager = {
  /**
   * 저장된 자동 저장 데이터를 불러옵니다.
   * @returns 저장된 데이터 또는 null
   */
  load(): AutosaveData | null {
    return safeLocalStorage.get<AutosaveData | null>(AUTOSAVE_KEY, null);
  },

  /**
   * 저장된 자동 저장 데이터를 삭제합니다.
   * (글이 성공적으로 발행된 후에 호출해야 합니다.)
   */
  clear(): void {
    safeLocalStorage.remove(AUTOSAVE_KEY);
  },
};