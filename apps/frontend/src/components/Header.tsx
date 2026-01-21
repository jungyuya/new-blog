// 파일 위치: apps/frontend/src/components/Header.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import ThemeToggleButton from './ThemeToggleButton';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchModal from './SearchModal';


const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

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
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 드롭다운 메뉴 상태
  const [isSearchOpen, setIsSearchOpen] = useState(false); // 검색 모달 상태
  const menuRef = useRef<HTMLDivElement>(null); // 드롭다운 메뉴의 ref

  useOnClickOutside(menuRef, () => setIsMenuOpen(false)); // 외부 클릭 시 메뉴 닫기

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '=' 키로 검색 모달 열기 (input/textarea 포커스 상태가 아닐 때만)
      if (e.key === '=' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Cmd+K 또는 Ctrl+K로도 열기 (많은 현대 앱의 표준)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-stone-950/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-colors duration-300">
        <nav className="container mx-auto px-4 sm:px-6 h-[60px] flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/deepdive-logo.png"
              alt="Deep Dive!"
              width={0}
              height={0}
              sizes="100vw"
              className="w-auto h-[45px] object-contain"
              priority
              unoptimized={true}
            />
          </Link>

          {/* [Epic 6] Navigation Links */}
          <nav className="hidden md:flex space-x-8 items-center">
            {/* [수정] 메인 페이지 드롭다운 필터로 통합됨에 따라 헤더 링크 제거 */}
            {/* <Link href="/?category=post" ... /> */}
            {/* <Link href="/learning" ... /> */}
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-4">

            <ThemeToggleButton />

            {/* 기존 Search 컴포넌트를 motion.button으로 교체 */}
            <motion.button
              layoutId="search-box"
              onClick={() => setIsSearchOpen(true)}
              className="relative p-2.5 rounded-xl group"
              aria-label="검색창 열기"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* 애니메이션 보더 */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

              {/* 메인 버튼 배경 */}
              <div className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 
    group-hover:border-transparent transition-colors duration-300">
                {/* [수정] hover 시 색상이 바뀌도록 class를 변경합니다. */}
                <div className="p-2 text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all duration-300">
                  <SearchIcon />
                </div>
              </div>

              {/* 반짝임 효과 */}
              <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse"></div>
            </motion.button>

            {isLoading ? (
              <div className="animate-pulse flex space-x-4">
                <div className="h-8 w-24 bg-gray-300 rounded"></div>
                <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
              </div>
            ) : user ? (
              // --- 로그인 상태 UI 구조 변경 ---
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
      </header >
      {/* 검색 모달 렌더링 로직 */}
      <AnimatePresence>
        {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
      </AnimatePresence >
    </>
  );
}