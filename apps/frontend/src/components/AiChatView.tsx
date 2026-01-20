// 파일 위치: apps/frontend/src/components/AiChatView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import MessageList from './chat-widget/MessageItem'; // MessageItem을 list로 렌더링할 컨테이너 필요하지만, 일단 Item을 직접 map
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

    // 2. 빈 AI 메시지 먼저 추가
    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, initialAiMsg]);

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
        throw new Error('Failed to get answer');
      }

      // 스트림 읽기
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let streamedContent = '';
      let sources: { title: string; url: string }[] = [];
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });

        // 첫 번째 청크에서 출처 정보 파싱
        if (isFirstChunk && text.includes('__SOURCES__')) {
          const match = text.match(/__SOURCES__(.*?)__SOURCES__/);
          if (match) {
            try {
              sources = JSON.parse(match[1]);
            } catch (e) {
              console.error('Failed to parse sources', e);
            }
            // 출처 정보 제거 후 나머지 텍스트만 사용
            streamedContent += text.replace(/__SOURCES__.*?__SOURCES__/, '');
          } else {
            streamedContent += text;
          }
          isFirstChunk = false;
        } else {
          streamedContent += text;
        }

        // 실시간 업데이트
        setMessages((prev) =>
          prev.map(msg =>
            msg.id === aiMsgId ? { ...msg, content: streamedContent } : msg
          )
        );
      }

      // 최종 업데이트 (출처 포함)
      setMessages((prev) =>
        prev.map(msg =>
          msg.id === aiMsgId ? { ...msg, content: streamedContent, sources } : msg
        )
      );

      // 쿼터 갱신
      fetchQuota();

    } catch (error: any) {
      // 에러 발생 시 placeholder 제거하고 에러 메시지로 교체
      setMessages((prev) =>
        prev.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, content: `죄송합니다. 오류가 발생했습니다. (${error.message})` }
            : msg
        )
      );
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