import { Code2, MessageCircle, TrendingDown, Dices } from 'lucide-react';
import { FaqItem } from '@/types/chat';

export const RANDOM_FAQ_POOL = [
    "다크모드 구현은 어떻게 했어?",
    "콜드스타트 문제는 어떻게 해결했어?",
    "TTS 서비스도 지원해?",
    "Bedrock을 활용한 3줄 요약 서비스는 어떻게 구현했어?",
    "RAG 챗봇 서비스는 어떻게 구현했어?",
    "검색 기능은 어떻게 구현했어?",
    "DynamoDB의 테이블을 몽땅 날린 경험도 있다던데 알려줘.",
    "목차 기능은 어떻게 구현한 거야?",
    "XSS 관련 보안 처리는 어떻게 구현했어?",
    "무한 스크롤도 구현 되어있네?",
    "OG 태그 도입한 과정의 게시글을 찾아줘."
];

export const FAQ_ITEMS: FaqItem[] = [
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
