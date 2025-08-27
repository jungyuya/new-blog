// 파일 위치: apps/frontend/src/components/Header.tsx (v1.1 - 권한 관리 로직 병합 최종본)
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  // [유지] 기존의 useAuth 훅 호출은 그대로 사용합니다.
  const { user, isLoading, logout } = useAuth();
  
  // [추가] user 객체가 존재할 때, 그의 groups 배열에 'Admins'가 포함되어 있는지 확인합니다.
  const isAdmin = user?.groups?.includes('Admins');

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-gray-800">
          Deep Dive Blog🐬
        </Link>

        <div className="flex items-center space-x-4">
          {/* [유지] 로딩 중 UI는 그대로 유지합니다. */}
          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-16 bg-gray-300 rounded"></div>
              <div className="h-8 w-16 bg-gray-300 rounded"></div>
            </div>
          ) : user ? (
            // [유지] 로그인 상태 UI는 그대로 유지합니다.
            <>
              <span className="text-gray-600">환영합니다! {user.email} 님!</span>
              
              {/* [핵심 수정] '새 글 작성' 버튼을 isAdmin이 true일 때만 렌더링하도록 <></>로 감싸고 조건을 추가합니다. */}
              {isAdmin && (
                <Link href="/posts/new" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                  새 글 작성
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                로그아웃
              </button>
            </>
          ) : (
            // [유지] 로그아웃 상태 UI는 그대로 유지합니다.
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