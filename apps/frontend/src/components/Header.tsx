// 파일 위치: apps/frontend/src/components/Header.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ThemeToggleButton from './ThemeToggleButton';
import { useState, useRef, useEffect } from 'react'; // [수정] 훅 추가
import { motion, AnimatePresence } from 'framer-motion'; // [수정] 애니메이션 라이브러리 추가

const useOnClickOutside = (ref: React.RefObject<HTMLDivElement | null>, handler: (event: MouseEvent | TouchEvent) => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

export default function Header() {
  const { user, isLoading, logout } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');
  const [isMenuOpen, setIsMenuOpen] = useState(false); // [추가] 드롭다운 메뉴 상태
  const menuRef = useRef<HTMLDivElement>(null); // [추가] 드롭다운 메뉴의 ref

  useOnClickOutside(menuRef, () => setIsMenuOpen(false)); // [추가] 외부 클릭 시 메뉴 닫기

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <header className="bg-white dark:bg-stone-950 shadow-md dark:shadow-none dark:border-b dark:border-gray-800 sticky top-0 z-50">
      {/* [수정] 모바일 화면에서 좌우 여백을 줄입니다. */}
      <nav className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/homelogo.webp" alt="Deep Dive! 로고" width={28} height={28} priority unoptimized={true} />
          <span className="text-xl font-bold text-gray-800 dark:text-gray-200">Deep Dive!</span>
        </Link>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <ThemeToggleButton />

          {isLoading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="h-8 w-24 bg-gray-300 rounded"></div>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
            </div>
          ) : user ? (
            // --- [핵심 수정] 로그인 상태 UI 구조 변경 ---
            <div className="relative" ref={menuRef}>
              {/* 1. 데스크탑 전용 전체 메뉴 */}
              <div className="hidden sm:flex items-center space-x-4">
                {isAdmin && (
                  <Link href="/posts/new" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">새 글 작성</Link>
                )}
                <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">로그아웃</button>
                {/* 데스크탑에서는 아바타와 닉네임이 함께 있는 링크를 사용합니다. */}
                <Link href="/mypage" className="flex items-center space-x-2">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                    <Image src={user.avatarUrl || '/default-avatar.png'} alt="프로필 사진" fill className="object-cover" sizes="32px" key={user.avatarUrl} />
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{user.nickname || user.email.split('@')[0]}</span>
                </Link>
              </div>

              {/* 2. 모바일 전용 메뉴 버튼 (아바타) */}
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="sm:hidden relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                <Image src={user.avatarUrl || '/default-avatar.png'} alt="프로필 사진" fill className="object-cover" sizes="32px" key={user.avatarUrl} />
              </button>

              {/* [추가] 모바일 전용 드롭다운 메뉴 */}
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="sm:hidden absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20"
                  >
                    <div className="py-1">
                      <div className="px-4 py-2 border-b dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-200">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.nickname || user.email}</p>
                      </div>
                      <div className="py-1">
                        {isAdmin && (
                          <Link href="/posts/new" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">새 글 작성</Link>
                        )}
                        <Link href="/mypage" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">마이페이지</Link>
                        <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">로그아웃</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            // --- 로그아웃 상태 ---
            <>
              <Link href="/login" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 text-sm font-medium">
                로그인
              </Link>
              {/* [수정] 회원가입 버튼을 모바일에서는 숨깁니다. */}
              <Link href="/signup" className="hidden sm:block px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}