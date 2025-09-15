// 파일 위치: apps/frontend/src/components/Header.tsx (v1.4 - 다크 모드 토글 적용)
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ThemeToggleButton from './ThemeToggleButton'; // [신규] 테마 토글 버튼 import

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
    // --- [핵심 수정 1] 헤더에 다크 모드 스타일을 적용합니다. ---
    <header className="bg-white dark:bg-gray-800 shadow-md dark:shadow-gray-700 sticky top-0 z-50 transition-colors">
      <nav className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/homelogo.webp"
            alt="Deep Dive! 로고"
            width={28}
            height={28}
            priority
            unoptimized={true}
          />
          {/* [수정] 텍스트 색상도 다크 모드를 지원하도록 변경 */}
          <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Deep Dive!
          </span>
        </Link>

        <div className="flex items-center space-x-4">
          {/* --- [핵심 수정 2] 토글 버튼을 조건부 렌더링 바깥으로 이동시켜 항상 보이게 합니다. --- */}
          <ThemeToggleButton />

          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-24 bg-gray-300 rounded"></div>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
            </div>
          ) : user ? (
            <>
              {isAdmin && (
                <Link href="/posts/new" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 dark:bg-primary-dark dark:hover:bg-primary-dark-hover">
                  새 글 작성
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
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
                {/* [수정] 텍스트 색상도 다크 모드를 지원하도록 변경 */}
                <span className="font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">
                  {user.nickname || user.email.split('@')[0]}
                </span>
              </Link>
            </>
          ) : (
            <>
              {/* [수정] 텍스트 색상도 다크 모드를 지원하도록 변경 */}
              <Link href="/login" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
                로그인
              </Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 dark:bg-primary-dark dark:hover:bg-primary-dark-hover">
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}