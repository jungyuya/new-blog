// 파일 위치: apps/frontend/src/components/AiChatView.tsx
'use client';

import React, { useEffect } from 'react';
import MessageItem from './chat-widget/MessageItem';
import MessageInput from './chat-widget/MessageInput';
import { FAQ_ITEMS, RANDOM_FAQ_POOL } from '@/constants/chat';
import { useChat } from '@/hooks/useChat';

interface AiChatViewProps {
  isOpen: boolean;
}

const AiChatView = ({ isOpen }: AiChatViewProps) => {
  const {
    messages,
    isLoading,
    quota,
    clickedChipIndex,
    setClickedChipIndex,
    showFAQ,
    messagesEndRef,
    handleSendMessage
  } = useChat(isOpen);

  // Code Splitting 검증용 로그
  useEffect(() => {
    console.log('[AiChatView] Component Loaded! (Code Splitting Verified)');
  }, []);

  return (
    <div className="flex flex-col h-full bg-chat-bg">
      {/* 쿼터 표시 바 */}
      <div className="bg-white/80 backdrop-blur-sm px-4 py-2 text-xs text-chat-text-dark border-b border-gray-100 flex justify-between items-center shadow-sm z-10">
        <span>⚡ AI 검색</span>
        <span className="font-mono text-chat-text-assistant">
          남은 질문: <strong>{quota ? quota.remaining : '-'}</strong> / {quota ? quota.total : '-'}
        </span>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

        {/* 추천 질문 (초기 상태에서만 표시) */}
        {messages.length === 1 && (
          <div className={`mt-4 max-w-2xl mx-auto transition-all duration-500 ${showFAQ ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${clickedChipIndex !== null ? 'opacity-0' : ''}`}>
            {/* Glassmorphism 컨테이너 - Option 1+3 하이브리드 */}
            <div className="bg-gradient-to-br from-blue-50/60 via-cyan-50/40 to-purple-50/20 rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/50 shadow-2xl shadow-blue-500/20">
              {/* 애니메이션 배경 레이어 (선택적) */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-cyan-400/5 animate-pulse blur-2xl" />

              {/* 실제 컨텐츠 */}
              <div className="relative z-10">

                {/* Step 1.12: 섹션 제목 시각적 강조 */}
                <div className="flex items-center gap-3 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <h3 className="text-base md:text-lg text-gray-700 dark:text-gray-300 font-bold">
                    자주 묻는 질문
                  </h3>
                </div>

                {/* Step 1.14: 그리드 레이아웃 균형 - 2×2 그리드 */}
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                  {/* FAQ 카드 - Lucide 아이콘 + 중앙 정렬 디자인 */}
                  {FAQ_ITEMS.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setClickedChipIndex(idx);
                          setTimeout(() => {
                            let questionToSend = item.text;
                            if (idx === 3) {
                              const randomIndex = Math.floor(Math.random() * RANDOM_FAQ_POOL.length);
                              questionToSend = RANDOM_FAQ_POOL[randomIndex];
                            }
                            handleSendMessage(questionToSend);
                            setTimeout(() => setClickedChipIndex(null), 100);
                          }, 150);
                        }}
                        className={`group w-full relative overflow-hidden
                          backdrop-blur-md 
                          rounded-2xl p-5 
                          shadow-lg 
                          transition-all duration-300 ease-out
                          text-center
                          ${clickedChipIndex === idx ? 'scale-95 opacity-80' : ''}
                          ${'isSpecial' in item && item.isSpecial
                            ? 'bg-gradient-to-br from-amber-50/80 via-yellow-50/60 to-orange-50/40 border-2 border-amber-300/60 shadow-amber-200/50 hover:border-amber-400/80 hover:shadow-xl hover:shadow-amber-300/40'
                            : `bg-gradient-to-br ${item.bgAccent} bg-white/70 border border-white/60 hover:bg-white/90 hover:border-white/80 hover:shadow-xl ${item.hoverGlow}`
                          }
                          hover:scale-[1.03] hover:-translate-y-1`}
                      >
                        {/* 황금 카드 미묘한 빛 효과 */}
                        {'isSpecial' in item && item.isSpecial && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />
                        )}
                        {/* 중앙 아이콘 박스 */}
                        <div className="relative flex justify-center mb-4">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg ${item.hoverGlow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${'isSpecial' in item && item.isSpecial ? 'ring-2 ring-amber-300/50 ring-offset-2 ring-offset-amber-50/50' : ''}`}>
                            <IconComponent className={`w-7 h-7 ${'isSpecial' in item && item.isSpecial ? 'text-amber-900' : 'text-white'}`} strokeWidth={2} />
                          </div>
                        </div>
                        {/* 중앙 정렬 텍스트 */}
                        <p className={`text-sm font-semibold leading-relaxed ${'isSpecial' in item && item.isSpecial ? 'text-amber-800' : 'text-gray-700'}`}>{item.text}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 text-xs text-gray-400">
              답변을 생성하고 있습니다...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default AiChatView;