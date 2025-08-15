// 파일 위치: apps/frontend/src/contexts/AuthContext.tsx
// 역할: 애플리케이션 전체의 인증 상태(사용자 정보, 로딩 상태)를 관리하고 공유하는 Context를 정의합니다.

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// [수정] 백엔드에서 사용자 정보를 가져오기 위한 api 객체를 임포트합니다.
// GET /api/users/me 엔드포인트가 필요하므로, api.ts에 해당 함수를 추가해야 합니다.
// 지금은 임시로 주석 처리하고, 다음 단계에서 api.ts를 수정하겠습니다.
// import { api } from '@/utils/api'; 

// 사용자 정보의 타입을 정의합니다. 백엔드의 응답과 일치해야 합니다.
interface User {
  id: string;
  email: string;
}

// Context가 제공할 값들의 타입을 정의합니다.
interface AuthContextType {
  user: User | null;      // 현재 로그인된 사용자 정보 (없으면 null)
  isLoading: boolean;     // 사용자 정보를 불러오는 중인지 여부
  // TODO: 로그인, 로그아웃 함수도 여기에 추가될 예정입니다.
}

// Context 객체를 생성합니다. 초기값은 undefined로 설정하여,
// Provider 없이 사용될 경우 에러를 발생시키도록 합니다.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 자식 컴포넌트들에게 인증 상태를 제공하는 Provider 컴포넌트입니다.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 앱 시작 시 항상 로딩 상태로 시작

  useEffect(() => {
    // 컴포넌트가 처음 마운트될 때, 쿠키를 통해 로그인 상태를 확인하는 함수를 호출합니다.
    const checkUserStatus = async () => {
      try {
        // [임시] 아직 /api/users/me가 없으므로, 일단 비로그인 상태로 처리합니다.
        // TODO: 아래 주석을 해제하고 실제 API를 호출해야 합니다.
        // const response = await api.fetchCurrentUser(); 
        // setUser(response.user);
        console.log("AuthProvider: No user session found (placeholder).");
      } catch (error) {
        // API 호출 실패 시 (예: 유효하지 않은 쿠키), 비로그인 상태로 간주합니다.
        console.error('Failed to fetch current user:', error);
        setUser(null);
      } finally {
        // API 호출이 성공하든 실패하든, 로딩 상태를 해제합니다.
        setIsLoading(false);
      }
    };

    checkUserStatus();
  }, []); // [] 의존성 배열은 이 useEffect가 컴포넌트 마운트 시 한 번만 실행되도록 합니다.

  const value = { user, isLoading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 컴포넌트에서 Context를 쉽게 사용하기 위한 커스텀 훅입니다.
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // AuthProvider로 감싸져 있지 않은 곳에서 이 훅을 사용하면 에러를 발생시킵니다.
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}