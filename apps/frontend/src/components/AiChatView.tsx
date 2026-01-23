// 파일 위치: apps/frontend/src/components/AiChatView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import MessageList from './chat-widget/MessageItem';
import MessageItem, { ChatMessage } from './chat-widget/MessageItem';
import MessageInput from './chat-widget/MessageInput';
import { RANDOM_FAQ_POOL } from '../constants/chat';

// Step 1.9: FAQ 항목을 배열로 관리하여 확장성 확보
const FAQ_ITEMS = [
  {
    text: "기술 스택 알려줘",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  },
  {
    text: "이 블로그는 뭐야?",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    text: "AWS 비용 절감 팁",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    text: "오늘의 추천 질문 🎲",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

interface AiChatViewProps {
  isOpen: boolean;
}

const AiChatView = ({ isOpen }: AiChatViewProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요! 블로그에 대해 궁금한 점이 있으신가요? 무엇이든 물어보세요.',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; total: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Step 1.10: 클릭한 FAQ 칩 추적 및 페이드아웃 상태
  const [clickedChipIndex, setClickedChipIndex] = useState<number | null>(null);

  // Step 1.4: FAQ 섹션 진입 애니메이션 지연을 위한 상태
  const [showFAQ, setShowFAQ] = useState(false);

  // FAQ 섹션 표시 지연 (채팅 위젯이 열릴 때 300ms 후)
  useEffect(() => {
    if (isOpen) {
      setShowFAQ(false); // 먼저 숨김
      const timer = setTimeout(() => setShowFAQ(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowFAQ(false);
    }
  }, [isOpen]);

  // 쿼터 조회
  useEffect(() => {
    fetchQuota();
  }, []);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/chat/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch (e) {
      console.error('Failed to fetch quota', e);
    }
  };

  const handleSendMessage = async (content: string) => {
    // 1. 사용자 메시지 추가
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 대화 히스토리 준비
      const history = messages
        .filter(m => m.id !== 'welcome' && !m.content.startsWith('죄송합니다. 오류가 발생했습니다.'))
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // API 호출
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: content, history }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        // 가드레일 차단
        if (res.status === 400 && errorData.error === 'GUARDRAIL_BLOCKED') {
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ ${errorData.message || '부적절한 질문이 감지되었습니다. 정중한 표현을 사용해주세요.'}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsLoading(false);
          return;
        }

        // 쿼터 초과
        if (res.status === 429 && errorData.error === 'QUOTA_EXCEEDED') {
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '⚠️ 오늘의 질문 횟수를 모두 사용했습니다. 내일 다시 시도해주세요.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsLoading(false);
          return;
        }

        throw new Error('Failed to get answer');
      }

      // 응답 처리
      const data = await res.json();

      // AI 답변 추가
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        sources: data.sources,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // 쿼터 갱신
      fetchQuota();

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다. (${error.message})`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                  {/* Step 1.5-1.8 & 1.9-1.10: FAQ 항목 배열 사용 및 클릭 피드백 */}
                  {FAQ_ITEMS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // Step 1.10: 클릭 시 펄스 애니메이션 및 페이드 아웃
                        setClickedChipIndex(idx);
                        // 짧은 지연 후 메시지 전송 (애니메이션 시간 확보)
                        setTimeout(() => {
                          let questionToSend = item.text;
                          // 4번째 카드(인덱스 3)인 경우 랜덤 질문 선택
                          if (idx === 3) {
                            const randomIndex = Math.floor(Math.random() * RANDOM_FAQ_POOL.length);
                            questionToSend = RANDOM_FAQ_POOL[randomIndex];
                          }
                          handleSendMessage(questionToSend);
                          // 메시지 전송 후 상태 초기화
                          setTimeout(() => setClickedChipIndex(null), 100);
                        }, 150);
                      }}
                      className={`group w-full
                        backdrop-blur-md 
                        border-2 
                        rounded-2xl p-5 
                        shadow-lg 
                        transition-all duration-300 
                        ring-1 ring-inset ring-white/30
                        text-left space-y-3
                        ${clickedChipIndex === idx ? 'animate-pulse' : ''}
                        ${idx === 3
                          ? 'bg-gradient-to-br from-white/80 via-purple-50/30 to-pink-50/30 border-purple-100 hover:border-purple-300/50 hover:shadow-purple-500/10'
                          : 'bg-white/70 border-white/60 hover:bg-white/90 hover:border-blue-300/50 hover:shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20'
                        }
                        hover:scale-[1.02]`}
                    >
                      {/* 상단: 아이콘 박스 + 화살표 */}
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:shadow-lg group-hover:shadow-blue-500/40 transition-all duration-300">
                          <span className="text-white text-lg">{item.icon}</span>
                        </div>
                        <svg className="w-5 h-5 text-blue-400/60 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-gray-700 leading-snug">{item.text}</p>
                    </button>
                  ))}
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