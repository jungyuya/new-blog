// 파일 위치: apps/frontend/src/components/ChatWidget.tsx
"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const AiChatView = dynamic(() => import('./AiChatView'), {
  loading: () => null, // 초기 로딩 시 아무것도 보여주지 않음 (채팅창이 닫혀 있으므로)
  ssr: false, // 클라이언트 전용 기능이므로 SSR 불필요
});

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  // [Code Splitting] 최초 한 번이라도 열렸는지 추적하여, 그 전까지는 AiChatView를 로드하지 않음
  const [hasOpened, setHasOpened] = useState(false);
  // [Performance] 실시간 채팅 탭이 한 번이라도 활성화되었는지 추적 (iframe 지연 로딩)
  const [hasOpenedLiveTab, setHasOpenedLiveTab] = useState(false);

  // 탭 상태 관리 ('ai' | 'live')
  const [activeTab, setActiveTab] = useState<'ai' | 'live'>('ai');

  useEffect(() => {
    const showTimer = setTimeout(() => setShowGreeting(true), 1000);
    const hideTimer = setTimeout(() => setShowGreeting(false), 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    // 처음 열릴 때 hasOpened를 true로 설정하여 AiChatView 로딩 트리거
    if (nextState && !hasOpened) {
      setHasOpened(true);
    }

    if (!nextState) {
      setShowGreeting(false);
      // setIsExpanded는 초기값(true)을 유지하도록 제거
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[9999] flex flex-col items-start gap-4 font-sans">

      {/* 1. 채팅창 컨테이너 */}
      <div
        className={`
          flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl border border-gray-200
          transition-all duration-300 ease-in-out origin-bottom-left
          ${isOpen
            ? isExpanded
              ? 'w-[calc(100vw-32px)] h-[90vh] md:w-[700px] md:h-[800px] opacity-100 scale-100 translate-y-0'
              : 'w-[calc(100vw-32px)] h-[75vh] md:w-[360px] md:h-[600px] opacity-100 scale-100 translate-y-0'
            : 'w-0 h-0 opacity-0 scale-95 translate-y-20 pointer-events-none'
          }
        `}
      >
        {/* 헤더 (탭 포함) */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-400 p-0 flex flex-col shadow-md z-20">

          {/* 상단 컨트롤 바 */}
          <div className="flex justify-between items-start px-4 pt-3 pb-1">
            <div className="flex flex-col text-white">
              <span className="font-bold text-lg leading-tight">Deep Dive!</span>
              <span className="text-xs text-blue-50 opacity-90">AI 챗봇 & 실시간 문의</span>
            </div>
            <div className="flex items-center gap-1">
              {/* 확대/축소 버튼 */}
              <button onClick={toggleExpand} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10">
                {isExpanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6m0 0v6M20 10h-6m0 0V4" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" /></svg>
                )}
              </button>
              {/* 닫기 버튼 */}
              <button onClick={toggleChat} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* 탭 버튼 */}
          <div className="flex px-2 mt-2">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'ai' ? 'text-white' : 'text-blue-100 hover:text-white'
                }`}
            >
              🤖 AI 검색
              {activeTab === 'ai' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white rounded-t-md" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('live'); setHasOpenedLiveTab(true); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'live' ? 'text-white' : 'text-blue-100 hover:text-white'
                }`}
            >
              💬 실시간 대화방
              {activeTab === 'live' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white rounded-t-md" />
              )}
            </button>
          </div>
        </div>

        {/* 본문 영역 (조건부 렌더링) */}
        <div className="flex-grow overflow-hidden relative bg-chat-bg">
          {/* AI 탭 */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'ai' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            {/* hasOpened가 true일 때만 AiChatView 렌더링 (Code Splitting 효과) */}
            {(isOpen || hasOpened) && <AiChatView isOpen={isOpen} />}
          </div>

          {/* 실시간 탭 (iframe은 렌더링 비용이 크므로 최초 탭 활성화 시에만 로드) */}
          <div className={`absolute inset-0 bg-white transition-opacity duration-300 ${activeTab === 'live' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            {/* [Performance] 실시간 탭이 한 번이라도 활성화된 후에만 iframe을 렌더링합니다 */}
            {hasOpenedLiveTab && (
              <iframe
                src="https://chat.jungyu.store"
                title="Realtime Chat Room"
                className="w-full h-full border-none"
                allow="clipboard-read; clipboard-write"
              />
            )}
          </div>
        </div>
      </div>

      {/* 2. 플로팅 버튼 (기존 동일) */}
      <div
        className="relative flex items-end"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/*메인 버튼*/}
        <button
          onClick={toggleChat}
          className={`
            relative flex items-center justify-center transition-all duration-300 focus:outline-none
            ${isOpen
              ? 'w-12 h-12 md:w-14 md:h-14 bg-gray-800 rounded-full shadow-lg rotate-90'
              : 'w-20 h-20 md:w-24 md:h-24 bg-transparent rotate-0 hover:scale-125'
            } 
          `}
          aria-label="Open Chat"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            // 로고 이미지 (경로 확인 필요)
            <img src="/logo-chat1.png" alt="Chat" className="w-full h-full object-cover rounded-full" />
          )}
        </button>

        {/* 말풍선 */}
        {!isOpen && (
          <div
            className={`
              absolute left-full ml-4 w-max bottom-8
              bg-white text-gray-800 text-sm font-bold px-4 py-2 rounded-xl shadow-lg border border-gray-100
              transition-all duration-300 origin-bottom-left select-none z-10
              ${(isHovered || showGreeting) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}
            `}
          >
            <div className="absolute bottom-3 -left-1.5 w-3 h-3 bg-white border-l border-b border-gray-100 transform rotate-45"></div>
            무엇이든 물어보세요!
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWidget;