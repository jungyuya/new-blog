// 파일 위치: apps/frontend/src/contexts/AuthContext.tsx (v2.1 - 상태 갱신 기능 추가)
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, Dispatch, SetStateAction } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/navigation';

// User 타입 정의 (변경 없음)
interface User {
  id: string;
  email: string;
  groups?: string[];
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
}

// [핵심 수정 1] Context가 제공할 값의 타입(설계도)에 상태 갱신 함수를 추가합니다.
interface AuthContextType {
  user: User | null;
  // [추가] setUser 함수의 타입을 명시적으로 정의합니다.
  // User 또는 null 값을 받을 수 있는 상태 설정 함수라는 의미입니다.
  setUser: Dispatch<SetStateAction<User | null>>;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // checkUserStatus는 이제 'refreshUser'라는 이름으로 외부에도 제공됩니다.
  const refreshUser = useCallback(async () => {
    // 로딩 상태를 다시 true로 설정하여, 갱신 중임을 UI에 알릴 수 있습니다.
    // (선택 사항: 지금은 그대로 두겠습니다.)
    try {
      const response = await api.fetchCurrentUser();
      if (response.user) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.warn('AuthProvider: Failed to refresh user session.', error);
      setUser(null);
    } finally {
      // 최초 로딩 시에만 isLoading을 false로 변경하기 위해,
      // isLoading이 true일 때만 false로 바꾸는 로직을 추가할 수 있습니다.
      if (isLoading) {
        setIsLoading(false);
      }
    }
  }, [isLoading]); // isLoading을 의존성에 추가

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 마운트 시에만 실행되도록 의도적으로 의존성 배열을 비웁니다.

  const login = async (credentials: { email: string; password: string }) => {
    await api.login(credentials);
    await refreshUser(); // checkUserStatus 대신 refreshUser 호출
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout failed in AuthContext:', error);
      throw error;
    }
  };

  // [핵심 수정 2] 외부에 제공할 실제 값(제품)에 refreshUser 함수를 포함합니다.

  const value = { user, setUser, isLoading, login, logout, refreshUser };
  
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