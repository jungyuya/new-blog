// 파일 위치: apps/frontend/src/components/Header.tsx (v1.2 - 프로필 UI 적용)
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image'; // [추가] Image 컴포넌트 import

export default function Header() {
  const { user, isLoading, logout } = useAuth();
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
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-gray-800">
          Deep Dive Blog🐬
        </Link>

        <div className="flex items-center space-x-4">
          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-24 bg-gray-300 rounded"></div>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
            </div>
          ) : user ? (
            // --- [핵심 수정] 로그인 상태 UI ---
            <>
              {isAdmin && (
                <Link href="/posts/new" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                  새 글 작성
                </Link>
              )}
              
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-indigo-600"
              >
                로그아웃
              </button>

              {/* 프로필 링크 (아바타 + 닉네임) */}
              <Link href="/mypage" className="flex items-center space-x-2">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  <Image
                    src={user.avatarUrl || '/default-avatar.png'}
                    alt="프로필 사진"
                    fill
                    className="object-cover"
                    sizes="32px"
                    key={user.avatarUrl} // URL 변경 시 리렌더링 강제
                  />
                </div>
                <span className="font-semibold text-gray-700 hidden sm:block">
                  {user.nickname || user.email.split('@')[0]}
                </span>
              </Link>
            </>
          ) : (
            // --- 로그아웃 상태 UI (변경 없음) ---
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