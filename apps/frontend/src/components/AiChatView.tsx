// 파일 위치: apps/frontend/src/components/AiChatView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import MessageList from './chat-widget/MessageItem';
import MessageItem, { ChatMessage } from './chat-widget/MessageItem';
import MessageInput from './chat-widget/MessageInput';
import { RANDOM_FAQ_POOL } from '../constants/chat';
import { Code2, MessageCircle, TrendingDown, Dices } from 'lucide-react';

// FAQ 항목을 배열로 관리하여 확장성 확보
const FAQ_ITEMS = [
  {
    text: "블로그의 기술 스택 알려줘!",
    icon: Code2,
    gradient: "from-blue-500 to-cyan-400",
    hoverGlow: "group-hover:shadow-blue-500/40",
    bgAccent: "from-blue-50/50 to-cyan-50/30"
  },
  {
    text: "실시간 채팅 서비스는 뭐야?",
    icon: MessageCircle,
    gradient: "from-emerald-500 to-teal-400",
    hoverGlow: "group-hover:shadow-emerald-500/40",
    bgAccent: "from-emerald-50/50 to-teal-50/30"
  },
  {
    text: "AWS 비용 절감한 사례 보여줘.",
    icon: TrendingDown,
    gradient: "from-amber-500 to-orange-400",
    hoverGlow: "group-hover:shadow-amber-500/40",
    bgAccent: "from-amber-50/50 to-orange-50/30"
  },
  {
    text: "오늘의 추천 질문 🎲",
    icon: Dices,
    gradient: "from-amber-400 via-yellow-300 to-amber-500",
    hoverGlow: "group-hover:shadow-amber-400/50",
    bgAccent: "from-amber-50/60 via-yellow-50/40 to-orange-50/30",
    isSpecial: true
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