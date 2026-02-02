import { LucideIcon } from 'lucide-react';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: { title: string; url: string }[];
}

export interface Quota {
    remaining: number;
    total: number;
}

export interface FaqItem {
    text: string;
    icon: LucideIcon;
    gradient: string;
    hoverGlow: string;
    bgAccent: string;
    isSpecial?: boolean;
}
