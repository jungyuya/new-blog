// 파일 위치: apps/frontend/src/components/AiChatView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import MessageList from './chat-widget/MessageItem';
import MessageItem, { ChatMessage } from './chat-widget/MessageItem';
import MessageInput from './chat-widget/MessageInput';

const AiChatView = () => {
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
          <div className="flex flex-col gap-2 mt-4 animate-fade-in-up">
            <p className="text-xs text-gray-400 ml-2 mb-1">자주 묻는 질문</p>
            <div className="flex flex-wrap gap-2">
              {["기술 스택 알려줘 🛠️", "이 블로그는 뭐야? 🤔", "AWS 비용 절감 팁 💰"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSendMessage(chip)}
                  className="bg-white border border-gray-200 text-gray-600 text-xs px-3 py-2 rounded-full hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors shadow-sm text-left"
                >
                  {chip}
                </button>
              ))}
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