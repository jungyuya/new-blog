// 파일 위치: apps/frontend/src/components/BackToTopButton.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ArrowUp, ChevronUp } from 'lucide-react';

// Throttle 유틸리티 함수 (성능 최적화)
const throttle = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastRan = 0;
  
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastRan >= delay) {
      func(...args);
      lastRan = now;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastRan = Date.now();
      }, delay - (now - lastRan));
    }
  };
};

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isNearTop, setIsNearTop] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 스크롤 위치를 계산하는 함수
  const updateScrollProgress = useCallback(() => {
    const scrollPx = window.scrollY;
    const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (winHeightPx > 0) {
      const scrolled = (scrollPx / winHeightPx) * 100;
      setScrollProgress(scrolled);
    }
    
    // 300px 이상 스크롤했을 때 버튼 표시
    setIsVisible(scrollPx > 300);
    // 상단 근처(500px 이내)인지 체크
    setIsNearTop(scrollPx < 500 && scrollPx > 0);
  }, []);

  // 스크롤 이벤트에 throttle을 적용하여 리스너 등록
  useEffect(() => {
    const handleScroll = throttle(updateScrollProgress, 100);
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollProgress(); // 초기 로드 시 한 번 실행
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [updateScrollProgress]);

  // 최상단으로 스크롤하는 함수 (easing 추가)
  const scrollToTop = () => {
    const scrollStep = -window.scrollY / 25;
    const scrollInterval = setInterval(() => {
      if (window.scrollY !== 0) {
        window.scrollBy(0, scrollStep);
      } else {
        clearInterval(scrollInterval);
      }
    }, 15);
  };

  // Progress circle dimensions
  const size = 56; // 버튼 크기 증가
  const strokeWidth = 2.5;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (scrollProgress / 100) * circumference;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 100 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
          }}
          exit={{ 
            opacity: 0, 
            scale: 0.8, 
            y: 100,
          }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
          className="fixed bottom-8 right-8 z-50 group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect background */}
          <motion.div
            className="absolute inset-0 rounded-full opacity-30 blur-xl"
            animate={{
              scale: isHovered ? 1.5 : 1,
              opacity: isHovered ? 0.5 : 0.3,
            }}
            transition={{ duration: 0.3 }}
            style={{
              background: `radial-gradient(circle, ${
                scrollProgress > 66 
                  ? 'rgb(239 68 68)' 
                  : scrollProgress > 33 
                  ? 'rgb(251 191 36)' 
                  : 'rgb(59 130 246)'
              } 0%, transparent 70%)`,
            }}
          />

          <motion.button
            onClick={scrollToTop}
            whileHover={{ scale: 1.1, rotate: 360 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: isHovered 
                ? '0 20px 40px -15px rgba(0, 0, 0, 0.3), 0 0 30px rgba(59, 130, 246, 0.3)' 
                : '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            className={`
              relative w-14 h-14 
              backdrop-blur-xl 
              ${isNearTop 
                ? 'bg-gradient-to-br from-blue-500/40 to-purple-500/40' 
                : 'bg-gradient-to-br from-sky-200/80 to-indigo-500/70 dark:from-gray-800/40 dark:to-gray-900/40 text-white'
              }
              border border-sky-200/60 dark:border-gray-600/30
              rounded-full 
              shadow-2xl 
              hover:shadow-3xl 
              focus:outline-none 
              focus:ring-4 
              focus:ring-blue-500/30 
              dark:focus:ring-blue-400/30
              focus:ring-offset-2 
              focus:ring-offset-sky-50
              dark:focus:ring-offset-gray-900
              transition-all duration-500 ease-out
              overflow-hidden
            `}
            aria-label="맨 위로 가기"
            style={{
              background: isHovered 
                ? `linear-gradient(135deg, 
                    ${scrollProgress > 66 
                      ? 'rgba(239, 68, 68, 0.4), rgba(185, 28, 28, 0.4)' 
                      : scrollProgress > 33 
                      ? 'rgba(251, 191, 36, 0.4), rgba(217, 119, 6, 0.4)' 
                      : 'rgba(59, 130, 246, 0.4), rgba(147, 51, 234, 0.4)'
                    })`
                : undefined,
            }}
          >
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 opacity-50"
              animate={{
                background: [
                  'radial-gradient(circle at 20% 80%, transparent 50%, rgba(59, 130, 246, 0.3) 100%)',
                  'radial-gradient(circle at 80% 20%, transparent 50%, rgba(147, 51, 234, 0.3) 100%)',
                  'radial-gradient(circle at 20% 80%, transparent 50%, rgba(59, 130, 246, 0.3) 100%)',
                ],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            {/* Progress circle SVG */}
            <svg 
              className="absolute inset-0 -rotate-90" 
              width={size} 
              height={size}
            >
              {/* Background circle */}
              <circle 
                cx={center} 
                cy={center} 
                r={radius} 
                stroke="currentColor" 
                strokeWidth={strokeWidth} 
                fill="none" 
                className="text-gray-400/40 dark:text-gray-600/20" 
              />
              
              {/* Progress circle */}
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeLinecap="round"
                animate={{
                  strokeDashoffset: offset,
                  stroke: scrollProgress > 66 
                    ? '#ef4444' 
                    : scrollProgress > 33 
                    ? '#fbbf24' 
                    : '#3b82f6',
                }}
                transition={{ 
                  strokeDashoffset: { duration: 0.2 },
                  stroke: { duration: 0.5 },
                }}
                style={{
                  filter: 'drop-shadow(0 0 6px currentColor)',
                }}
              />
            </svg>

            {/* Icon container with animation */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{
                y: isHovered ? -2 : 0,
              }}
              transition={{
                duration: 0.3,
                repeat: isHovered ? Infinity : 0,
                repeatType: "reverse",
              }}
            >
              <ChevronUp 
                className="w-6 h-6 text-white dark:text-gray-100 drop-shadow-md" 
                strokeWidth={2.5}
              />
            </motion.div>

            {/* Percentage text (appears on hover) */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-white dark:text-gray-100 drop-shadow-md">
                    {Math.round(scrollProgress)}%
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          
          {/* Enhanced tooltip */}
          <motion.div
            className="absolute right-full mr-4 top-1/2 -translate-y-1/2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              x: isHovered ? 0 : 10,
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative">
              {/* Tooltip arrow */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rotate-45" />
              
              {/* Tooltip content */}
              <div className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 text-white text-sm rounded-lg shadow-xl whitespace-nowrap backdrop-blur-md border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-medium">맨 위로</span>
                  <span className="text-xs opacity-70">
                    {Math.round(scrollProgress)}% 스크롤
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Ripple effect on click */}
          <AnimatePresence>
            {isNearTop && (
              <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}