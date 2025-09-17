// 파일 위치: apps/frontend/src/components/Header.tsx (v1.3 - 로고 이미지 적용)
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ThemeToggleButton from './ThemeToggleButton'; // [추가] 1. 토글 버튼 컴포넌트 import


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
    // [수정] 2. 헤더 자체에 다크 모드 스타일 적용 (배경색, 하단 테두리)
    <header className="bg-white dark:bg-stone-950 shadow-md dark:shadow-none dark:border-b dark:border-gray-800 sticky top-0 z-50">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/homelogo.webp"
            alt="Deep Dive! 로고"
            width={28}
            height={28}
            priority
            unoptimized={true}
          />
          {/* [수정] 3. 로고 텍스트에 다크 모드 스타일 적용 */}
          <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Deep Dive!
          </span>
        </Link>

        <div className="flex items-center space-x-4">
          <ThemeToggleButton /> {/* [추가] 4. 토글 버튼을 조건부 렌더링 바깥에 배치 */}
          
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
              {/* [수정] 5. 로그인 후 텍스트들에 다크 모드 스타일 적용 */}
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
                <span className="font-semibold text-gray-700 hidden sm:block dark:text-gray-200">
                  {user.nickname || user.email.split('@')[0]}
                </span>
              </Link>
            </>
          ) : (
            <>
              {/* [수정] 5. 로그아웃 상태 텍스트들에 다크 모드 스타일 적용 */}
              <Link href="/login" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
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