// 파일 위치: apps/frontend/src/contexts/AuthContext.tsx (v2.0 최종 리팩토링)
// 역할: 모든 인증 로직(상태, API 호출)을 중앙에서 관리하는 최종 버전.

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '@/utils/api'; 
import { useRouter } from 'next/navigation';

// 사용자 정보 타입 
interface User {
  id: string;
  email: string;
  groups?: string[]; // 사용자가 속한 그룹 목록 (예: ['Admins'])
}
// [개선] Context가 제공할 값들의 타입을 확장합니다.
// 로그인/로그아웃 함수를 추가하여 외부 컴포넌트에서 호출할 수 있도록 합니다.
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // [개념 설명] useCallback: React의 성능 최적화 훅(Hook)입니다.
  // 무엇(What): 함수를 메모리에 '기억(memoization)'해두는 역할을 합니다.
  // 왜(Why): 이 훅으로 감싸진 함수는, 의존성 배열([])의 값이 변경되지 않는 한,
  // 컴포넌트가 리렌더링 되어도 새로 생성되지 않습니다.
  // 이는 AuthProvider를 사용하는 자식 컴포넌트들의 불필요한 리렌더링을 방지하여 성능을 향상시킵니다.
  const checkUserStatus = useCallback(async () => {
    try {
      const response = await api.fetchCurrentUser(); 
      if (response.user) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.warn('AuthProvider: No active user session found.', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // 의존성 배열이 비어있으므로, 이 함수는 앱 전체 생명주기 동안 단 한번만 생성됩니다.

  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]); // checkUserStatus 함수가 변경될 때만 실행됩니다 (실질적으로는 최초 1회).

  // [추가] 로그인 함수
  const login = async (credentials: { email: string; password: string }) => {
    await api.login(credentials); // 1. API를 호출하여 서버에 쿠키를 생성합니다.
    await checkUserStatus();      // 2. 성공하면, 사용자 정보를 다시 가져와 React 상태를 업데이트합니다.
                                  // 3. 페이지 이동은 이 함수를 호출한 컴포넌트(Login.tsx)가 책임집니다.
  };

  // [추가] 로그아웃 함수
  const logout = async () => {
    try {
      await api.logout();
      setUser(null);      // React 상태를 즉시 비웁니다.
      router.push('/'); // 홈페이지로 이동합니다.
    } catch (error) {
      console.error('Logout failed in AuthContext:', error);
      throw error;
    }
  };

  const value = { user, isLoading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth 훅 (변경 없음)
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}