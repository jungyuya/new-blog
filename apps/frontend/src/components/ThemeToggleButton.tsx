// apps/frontend/src/components/ThemeToggleButton.tsx
'use client';

import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react'; // [추가]

export default function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false); // [추가]
  const { theme, setTheme } = useTheme();

  // [추가] useEffect는 클라이언트에서만, 그리고 컴포넌트가 마운트된 후에 실행됩니다.
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // [추가] 마운트 되기 전(서버 렌더링 시)에는 UI를 렌더링하지 않거나,
  // 레이아웃 쉬프트를 방지하기 위한 플레이스홀더를 렌더링합니다.
  if (!mounted) {
    return <div className="w-14 h-7" />; // 빈 공간을 차지하여 레이아웃이 깨지지 않도록 함
  }

  return (
    // 스위치의 트랙(배경) 역할을 하는 div 입니다.
    <div
      onClick={toggleTheme}
      className={`
        flex items-center w-14 h-7 rounded-full p-1 cursor-pointer
        ${theme === 'light' ? 'bg-gray-300 justify-start' : 'bg-blue-500 justify-end'}
      `}
    >
      {/* 스위치의 핸들(손잡이) 역할을 하는 motion.div 입니다. */}
      <motion.div
        className="w-5 h-5 bg-white rounded-full shadow-md"
        layout // 이 prop이 마법같은 자동 애니메이션을 만듭니다.
        transition={{ type: 'spring', stiffness: 700, damping: 30 }} // 통통 튀는 효과
      />
    </div>
  );
}