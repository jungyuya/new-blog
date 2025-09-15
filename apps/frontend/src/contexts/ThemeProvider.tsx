// 파일 위치: apps/frontend/src/contexts/ThemeProvider.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// 테마의 종류를 타입으로 명시
type Theme = 'light' | 'dark';

// Context가 제공할 값들의 타입을 정의
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Context 객체 생성
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider 컴포넌트
export function ThemeProvider({ children }: { children: ReactNode }) {
  // 1. 테마 상태를 관리합니다. 초기값은 'light'로 두지만, useEffect에서 즉시 실제 값으로 대체됩니다.
  const [theme, setTheme] = useState<Theme>('light');

  // 2. 컴포넌트가 클라이언트에서 마운트될 때 최초 한 번만 실행됩니다.
  useEffect(() => {
    // FOUC 방지 스크립트가 이미 <html>에 'dark' 클래스를 설정했을 수 있습니다.
    // 그 값을 읽어와 React 상태와 동기화합니다.
    const root = window.document.documentElement;
    const initialTheme = root.classList.contains('dark') ? 'dark' : 'light';
    setTheme(initialTheme);
  }, []);

  // 3. 테마를 전환하는 함수
  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      const root = window.document.documentElement;

      // <html> 태그의 클래스를 업데이트합니다.
      root.classList.remove(prevTheme);
      root.classList.add(newTheme);

      // localStorage와 쿠키에 새로운 테마 설정을 저장합니다.
      localStorage.setItem('theme', newTheme);
      // 쿠키는 1년(365일) 동안 유지되도록 설정합니다.
      document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

      return newTheme;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 4. Context를 쉽게 사용할 수 있게 해주는 커스텀 훅
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}