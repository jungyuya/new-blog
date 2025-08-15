// 파일 위치: apps/frontend/src/components/ProtectedRoute.tsx
// 역할: 자식 컴포넌트(페이지)를 래핑하여, 비로그인 사용자의 접근을 막고 로그인 페이지로 리디렉션시키는 '문지기' 컴포넌트

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// [개념 설명] Higher-Order Component (HOC) 패턴과 유사한 역할을 합니다.
// children prop을 받아서, 특정 조건 하에서만 이 children을 렌더링합니다.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. 인증 상태 확인이 아직 끝나지 않았다면(isLoading), 아무것도 하지 않고 기다립니다.
    if (isLoading) {
      return;
    }

    // 2. 로딩이 끝났는데, user 객체가 없다면(비로그인 상태),
    //    로그인 페이지로 리디렉션시킵니다.
    if (!user) {
      router.push('/login');
    }
    // 3. 로딩이 끝났고, user 객체가 있다면, 아무것도 하지 않고 children을 렌더링하도록 둡니다.

  }, [user, isLoading, router]); // user, isLoading, router 상태가 변경될 때마다 이 로직을 재실행합니다.

  // 로딩 중이거나, 로그인된 사용자일 경우에만 자식 컴포넌트(페이지)를 렌더링합니다.
  // 비로그인 사용자는 위 useEffect에 의해 /login으로 리디렉션되므로,
  // 이 컴포넌트가 잠시 렌더링되더라도 실제 페이지 내용은 보이지 않습니다.
  if (isLoading || !user) {
    // 로딩 중이거나 리디렉션이 발생하기 전까지 보여줄 UI (예: 전체 화면 로딩 스피너)
    // 여기서는 간단히 null을 반환하여 아무것도 표시하지 않습니다.
    return null; 
  }

  // 모든 조건을 통과한 경우, 보호하려던 페이지(children)를 렌더링합니다.
  return <>{children}</>;
}