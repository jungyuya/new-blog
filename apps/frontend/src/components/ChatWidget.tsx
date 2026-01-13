"use client";

import React, { useState, useEffect } from 'react';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  // [추가] 확대/축소 상태 관리
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setShowGreeting(true), 1000);
    const hideTimer = setTimeout(() => setShowGreeting(false), 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setShowGreeting(false);
      setIsExpanded(false); // 채팅창을 열 때마다 기본 크기로 초기화 (선택 사항)
    }
  };

  // 확대/축소 토글 함수
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    // [위치 반응형] 모바일: bottom-4 left-4 / 데스크톱(md): bottom-6 left-6
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[9999] flex flex-col items-start gap-4 font-sans">

      {/* 1. 채팅창 (Iframe) */}
      <div
        className={`
          overflow-hidden bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200
          transition-all duration-300 ease-in-out origin-bottom-left
          
          /* [크기 반응형 로직 수정] */
          ${isOpen
            ? isExpanded
              // [확대 상태]
              // 모바일: 너비는 그대로, 높이를 90vh로 확장
              // 데스크톱: 너비 700px, 높이 800px로 대폭 확장 (태블릿/PC에서 쾌적함)
              ? 'w-[calc(100vw-32px)] h-[90vh] md:w-[700px] md:h-[800px] opacity-100 scale-100 translate-y-0'
              // [기본 상태]
              // 모바일: 높이 75vh
              // 데스크톱: 너비 360px, 높이 600px
              : 'w-[calc(100vw-32px)] h-[75vh] md:w-[360px] md:h-[600px] opacity-100 scale-100 translate-y-0'
            : 'w-0 h-0 opacity-0 scale-95 translate-y-20 pointer-events-none'
          }
        `}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-5 py-4 flex justify-between items-center shadow-sm h-[64px]">
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight">💬실시간 대화방</span>
            <span className="text-xs text-blue-50 opacity-90">자유롭게 이야기 나눠요!</span>
          </div>

          {/* 우측 버튼 그룹 */}
          <div className="flex items-center gap-1">
            {/* 확대/축소 버튼 */}
            <button
              onClick={toggleExpand}
              className="text-white/80 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              title={isExpanded ? "기본 크기로" : "크게 보기"}
            >
              {isExpanded ? (
                // 축소 (Arrows pointing in - Minimize)
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6m0 0v6M20 10h-6m0 0V4" />
                </svg>
              ) : (
                // 확대 (Arrows pointing out - Maximize)
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" />
                </svg>
              )}
            </button>

            {/* 닫기 버튼 */}
            <button
              onClick={toggleChat}
              className="text-white/80 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              title="닫기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Iframe */}
        <iframe
          src="https://chat.jungyu.store"
          title="Realtime Chat Room"
          className="w-full h-[calc(100%-64px)] border-none bg-gray-50"
          allow="clipboard-read; clipboard-write"
        />
      </div>

      {/* 2. 버튼 그룹 (기존 동일) */}
      <div
        className="relative flex items-end"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 메인 버튼 */}
        <button
          onClick={toggleChat}
          className={`
            relative flex items-center justify-center transition-all duration-300 focus:outline-none
            ${isOpen
              ? 'w-12 h-12 md:w-14 md:h-14 bg-gray-800 rounded-full shadow-lg rotate-90'
              : 'w-20 h-20 md:w-32 md:h-32 bg-transparent rotate-0 hover:scale-105'
            } 
          `}
          aria-label="Open Chat Room"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <img
              src="/logo-chat.png"
              alt="Chat Dolphin"
              className="w-full h-full object-contain drop-shadow-xl"
            />
          )}
        </button>

        {/* 말풍선 (Greeting Bubble) - 기존 동일 */}
        {!isOpen && (
          <div
            className={`
              absolute left-full ml-2 w-max
              bottom-14 md:bottom-20
              bg-white text-gray-800 text-sm font-bold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-100
              transition-all duration-500 origin-bottom-left select-none z-10
              ${(isHovered || showGreeting)
                ? 'opacity-100 translate-x-0 scale-100'
                : 'opacity-0 -translate-x-4 scale-95 pointer-events-none'}
            `}
          >
            <div className="absolute bottom-4 -left-1.5 w-3 h-3 bg-white border-l border-b border-gray-100 transform rotate-45"></div>
            대화방 참여하기 👋
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWidget;