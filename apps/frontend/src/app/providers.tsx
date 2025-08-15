// 파일 위치: apps/frontend/src/app/providers.tsx
// 역할: 애플리케이션에서 사용될 모든 전역 Provider들을 한 곳에서 관리합니다.

'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}