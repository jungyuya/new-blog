// 파일 위치: apps/frontend/src/components/Header.tsx (v1.3 - 로고 이미지 적용)
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

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
        {/* --- [핵심 수정] 로고 부분을 이미지와 텍스트 조합으로 변경 --- */}
        <Link href="/" className="flex items-center space-x-2">
          {/* 1. 로고 이미지 추가 */}
          <Image
            src="/homelogo.webp" // public 디렉토리의 로고 파일 경로
            alt="Deep Dive! 로고"
            width={28} // 로고의 너비 (px)
            height={28} // 로고의 높이 (px)
            priority // 헤더 로고는 중요하므로 우선적으로 로드
          />
          {/* 2. 기존 텍스트 유지 */}
          <span className="text-xl font-bold text-gray-800">
            Deep Dive!
          </span>
        </Link>

        <div className="flex items-center space-x-4">
          {/* ... (오른쪽 메뉴 부분은 변경 없음) ... */}
          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-24 bg-gray-300 rounded"></div>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
            </div>
          ) : user ? (
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
              <Link href="/mypage" className="flex items-center space-x-2">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  <Image
                    src={user.avatarUrl || '/default-avatar.png'}
                    alt="프로필 사진"
                    fill
                    className="object-cover"
                    sizes="32px"
                    key={user.avatarUrl}
                  />
                </div>
                <span className="font-semibold text-gray-700 hidden sm:block">
                  {user.nickname || user.email.split('@')[0]}
                </span>
              </Link>
            </>
          ) : (
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