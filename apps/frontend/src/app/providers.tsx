// 파일 위치: apps/frontend/src/app/providers.tsx (v1.1 - ThemeProvider 추가)
// 역할: 애플리케이션에서 사용될 모든 전역 Provider들을 한 곳에서 관리합니다.

'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeProvider'; // [신규] ThemeProvider import
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    // 프로바이더들을 중첩하여 사용합니다.
    // 바깥쪽 프로바이더의 상태를 안쪽 프로바이더가 사용할 수 있습니다.
    // (현재는 서로 의존성이 없으므로 순서는 무관합니다.)
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}