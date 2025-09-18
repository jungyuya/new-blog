// apps/frontend/src/components/ThemeToggleButton.tsx
'use client';

import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

// 향상된 SVG 아이콘 컴포넌트 - 더 디테일하고 애니메이션 가능
const SunIcon = () => (
  <motion.svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    animate={{ rotate: 360 }}
    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
  >
    <defs>
      {/* [수정] id를 "sun-gradient"로 올바르게 변경합니다. */}
      <linearGradient id="sun-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF3C7" />  {/* 연한 노란색 */}
        <stop offset="100%" stopColor="#F59E0B" />  {/* 진한 노란색 */}
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="4" fill="url(#sun-gradient)" stroke="#F97316" strokeWidth="1" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="#F59E0B"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
    />
  </motion.svg>
);

const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
  >
    {/* defs 섹션 전체 삭제 가능 */}
    <path
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      fill="#FCD34D"   // <- 이렇게 변경
    />
    {/* 별 효과 추가 */}
    <motion.circle
      cx="18"
      cy="6"
      r="1"
      fill="#FCD34D"
      animate={{ opacity: [0, 1, 0], scale: [0.8, 1, 0.8] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    <motion.circle
      cx="16"
      cy="9"
      r="0.5"
      fill="#FCD34D"
      animate={{ opacity: [1, 0, 1], scale: [1, 0.8, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
    />
  </svg>
);

// 배경 구름/별 효과 컴포넌트
const CloudsBackground = () => (
  <div className="absolute inset-0 overflow-hidden rounded-full">
    <motion.div
      className="absolute w-8 h-2 bg-white/20 rounded-full"
      initial={{ x: -10, y: 2 }}
      animate={{ x: 60 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
    <motion.div
      className="absolute w-6 h-1.5 bg-white/15 rounded-full"
      initial={{ x: -10, y: 5 }}
      animate={{ x: 60 }}
      transition={{ duration: 10, repeat: Infinity, ease: "linear", delay: 2 }}
    />
  </div>
);

const StarsBackground = () => (
  <div className="absolute inset-0 overflow-hidden rounded-full">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-0.5 h-0.5 bg-white rounded-full"
        style={{
          left: `${20 + i * 15}px`,
          top: `${3 + (i % 2) * 4}px`,
        }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2 + i * 0.5, repeat: Infinity }}
      />
    ))}
  </div>
);

export default function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <div className="relative w-[72px] h-[32px] bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex items-center w-[72px] h-[32px] rounded-full p-1 cursor-pointer
        transition-all duration-500 ease-in-out overflow-hidden
        shadow-lg hover:shadow-xl
        ${isDark
          ? 'bg-gradient-to-r from-indigo-900 via-purple-950 to-indigo-900'
          : 'bg-gradient-to-r from-sky-400 via-blue-300 to-sky-500'
        }
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      role="switch"
      aria-checked={isDark}
    >
      {/* 배경 효과 */}
      <AnimatePresence mode="wait">
        {isDark ? (
          <motion.div
            key="stars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <StarsBackground />
          </motion.div>
        ) : (
          <motion.div
            key="clouds"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CloudsBackground />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토글 핸들 */}
      <motion.div
        className={`
          absolute w-[26px] h-[26px] rounded-full 
          flex items-center justify-center z-10
          ${isDark
            ? 'bg-gradient-to-br from-gray-950 to-white'
            : 'bg-gradient-to-br from-yellow-100 to-white'
          }
          shadow-lg
        `}
        animate={{
          x: isDark ? 40 : 2,
          rotate: isDark ? 360 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
        whileHover={{
          scale: 1.1,
          boxShadow: isDark
            ? '0 0 20px rgba(139, 92, 246, 0.5)'
            : '0 0 20px rgba(251, 191, 36, 0.5)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 180 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* 호버 시 글로우 효과 */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`
              absolute inset-0 rounded-full opacity-30
              ${isDark
                ? 'bg-gradient-to-r from-purple-400 to-pink-400'
                : 'bg-gradient-to-r from-yellow-300 to-orange-300'
              }
            `}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.3 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ filter: 'blur(10px)' }}
          />
        )}
      </AnimatePresence>

      {/* 툴팁 */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`
              absolute -bottom-10 left-1/2 transform -translate-x-1/2
              px-3 py-1 rounded-md text-xs font-medium
              whitespace-nowrap pointer-events-none z-50
              ${isDark
                ? 'bg-gray-800 text-gray-200'
                : 'bg-gray-700 text-white'
              }
            `}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            <div
              className={`
                absolute -top-1 left-1/2 transform -translate-x-1/2 
                w-2 h-2 rotate-45
                ${isDark ? 'bg-gray-800' : 'bg-gray-700'}
              `}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}