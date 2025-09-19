// 파일 위치: apps/frontend/src/components/SummaryModal.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext'; // [신규]
import { api } from '@/utils/api'; // [신규]

// 모달이 받을 props 타입 정의
interface SummaryModalProps {
  isOpen: boolean;
  isLoading: boolean;
  summary: string;
  onClose: () => void;
  postId: string; // [신규] 캐시 삭제 API 호출을 위해 postId가 필요

}

export default function SummaryModal({ isOpen, isLoading, summary, onClose, postId }: SummaryModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');

  const handleClearCache = async () => {
    if (!isAdmin) return;
    if (window.confirm('정말로 이 요약 캐시를 삭제하시겠습니까? 다음에 요약 요청 시 AI가 새로 생성하게 됩니다.')) {
      try {
        await api.deleteSummary(postId);
        alert('요약 캐시가 삭제되었습니다.');
        onClose(); // 성공 시 모달 닫기
      } catch (error) {
        console.error('Failed to clear summary cache:', error);
        alert('캐시 삭제에 실패했습니다.');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            // [수정] 1. 모달 컨테이너에 다크 모드 스타일 적용
            className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 dark:bg-stone-800 dark:border dark:border-gray-700"
          >
            {/* [수정] 2. 모달 헤더에 다크 모드 스타일 적용 */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI 요약</h3>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 min-h-[100px]">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 dark:border-blue-700 dark:border-t-blue-400"></div>
                      {/* [수정] 3. 로딩 텍스트에 다크 모드 색상 적용 */}
                      <p className="text-gray-600 dark:text-gray-300">AI가 글을 읽고 있어요...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    // [수정] 4. 요약 결과 텍스트에 다크 모드 색상 적용
                    className="text-gray-700 whitespace-pre-wrap leading-relaxed dark:text-gray-300"
                  >
                    {summary}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* [수정] 5. 모달 푸터에 다크 모드 스타일 적용 */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center dark:border-gray-700">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Powered by AWS Bedrock (Claude 3 Haiku)
              </span>
              {isAdmin && !isLoading && (
                <button
                  onClick={handleClearCache}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/50"
                >
                  🗑️요약캐시 삭제
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}