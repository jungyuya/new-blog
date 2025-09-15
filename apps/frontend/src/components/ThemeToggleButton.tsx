// 파일 위치: apps/frontend/src/components/ThemeToggleButton.tsx
'use client';

import { useTheme } from '@/contexts/ThemeProvider';
import { motion } from 'framer-motion';

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  // 테마가 아직 결정되지 않은 초기 상태(SSR)를 고려합니다.
  // 이 경우, 버튼을 렌더링하지 않거나 기본 상태로 보여줄 수 있습니다.
  // 여기서는 클라이언트에서 테마가 확정될 때까지 렌더링하지 않도록 처리합니다.
  if (!theme) {
    return <div className="w-14 h-8" />; // 깜빡임을 방지하기 위해 공간만 차지
  }

  return (
    <button
      onClick={toggleTheme}
      className={`relative flex items-center w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${theme === 'light' ? 'bg-blue-400' : 'bg-gray-700'
        }`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`absolute w-6 h-6 rounded-full shadow-md transition-colors duration-300 ease-in-out ${theme === 'light' ? 'bg-white' : 'bg-black'
          }`}
        style={{
          left: theme === 'light' ? '4px' : 'auto',
          right: theme === 'dark' ? '4px' : 'auto',
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* 아이콘들이 동그라미 밖으로 삐져나가지 않도록 overflow-hidden 추가 */}
          <motion.span
            className="absolute text-yellow-500"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: theme === 'light' ? 0 : -10, opacity: theme === 'light' ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            ☀️
          </motion.span>
          <motion.span
            className="absolute text-slate-300"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: theme === 'dark' ? 0 : -10, opacity: theme === 'dark' ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            🌙
          </motion.span>
        </div>
      </motion.div>
    </button>
  );
}