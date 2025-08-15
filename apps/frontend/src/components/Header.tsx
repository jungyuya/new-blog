// 파일 위치: apps/frontend/src/components/Header.tsx
// 역할: 로그인 상태에 따라 동적으로 메뉴를 변경하는 재사용 가능한 헤더 컴포넌트

'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  // [핵심] useAuth 훅을 호출하여 AuthContext의 현재 상태를 가져옵니다.
  const { user, isLoading, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // 성공 메시지나 추가적인 처리가 필요하다면 여기에 작성합니다.
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Failed to log out:', error);
      // 사용자에게 로그아웃 실패를 알리는 UI 처리 (예: toast 메시지)
    }
  };

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-gray-800">
          Jun-gyu's Blog
        </Link>

        <div className="flex items-center space-x-4">
          {/* --- [핵심] 조건부 렌더링 로직 --- */}
          {isLoading ? (
            // 1. 로딩 중일 때: 스켈레톤 UI를 보여주어 UX를 개선합니다.
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-16 bg-gray-300 rounded"></div>
              <div className="h-8 w-16 bg-gray-300 rounded"></div>
            </div>
          ) : user ? (
            // 2. 로그인 상태일 때: 사용자 이메일과 로그아웃 버튼을 보여줍니다.
            <>
              <span className="text-gray-600">환영합니다, {user.email} 님!</span>
              <Link href="/posts/new" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                새 글 작성
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                로그아웃
              </button>
            </>
          ) : (
            // 3. 로그아웃 상태일 때: 로그인, 회원가입 버튼을 보여줍니다.
            <>
              <Link href="/login" className="text-gray-600 hover:text-indigo-600">
                로그인
              </Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}