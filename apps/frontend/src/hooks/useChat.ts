import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Quota } from '@/types/chat';

export const useChat = (isOpen: boolean) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '안녕하세요! 블로그에 대해 궁금한 점이 있으신가요? 무엇이든 물어보세요.',
            timestamp: new Date(),
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [quota, setQuota] = useState<Quota | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // FAQ 및 UI 상태
    const [clickedChipIndex, setClickedChipIndex] = useState<number | null>(null);
    const [showFAQ, setShowFAQ] = useState(false);

    // FAQ 섹션 표시 지연
    useEffect(() => {
        if (isOpen) {
            setShowFAQ(false);
            const timer = setTimeout(() => setShowFAQ(true), 300);
            return () => clearTimeout(timer);
        } else {
            setShowFAQ(false);
        }
    }, [isOpen]);

    // 쿼터 조회
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

    useEffect(() => {
        fetchQuota();
    }, []);

    // 메시지 전송 핸들러
    const handleSendMessage = async (content: string) => {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const history = messages
                .filter(m => m.id !== 'welcome' && !m.content.startsWith('죄송합니다') && !m.content.startsWith('⚠️'))
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: content, history }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));

                if (res.status === 400 && errorData.error === 'GUARDRAIL_BLOCKED') {
                    const errorMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: `⚠️ ${errorData.message || '부적절한 질문이 감지되었습니다. 정중한 표현을 사용해주세요.'}`,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    return; // finally에서 isLoading false 처리
                }

                if (res.status === 429 && errorData.error === 'QUOTA_EXCEEDED') {
                    const errorMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: '⚠️ 오늘의 질문 횟수를 모두 사용했습니다. 내일 다시 시도해주세요.',
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    return;
                }

                throw new Error('Failed to get answer');
            }

            const data = await res.json();

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.answer,
                timestamp: new Date(),
                sources: data.sources,
            };
            setMessages((prev) => [...prev, aiMsg]);
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

    return {
        messages,
        isLoading,
        quota,
        clickedChipIndex,
        setClickedChipIndex,
        showFAQ,
        messagesEndRef,
        handleSendMessage
    };
};
