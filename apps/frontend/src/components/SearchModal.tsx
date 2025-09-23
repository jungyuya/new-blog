// 파일 위치: apps/frontend/src/components/SearchModal.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, ClockIcon, TrendingIcon, CloseIcon, ArrowRightIcon } from './Icons';


interface SearchModalProps {
    onClose: () => void;
}

// 인기검색어 : 현재는 트래픽이 없어 수동 관리하지만 추후 백엔드 로직 생성하여 실제 검색어 기능 구현 가능
const TRENDING_SEARCHES = [
    'OpenSearch',
    '최적화',
    'Bedrock',
    '다크 모드',
    'Sentry',
];

const RECENT_SEARCHES_KEY = 'recent-searches';

export default function SearchModal({ onClose }: SearchModalProps) {
    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isTyping, setIsTyping] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const combinedItems = useMemo(() => {
        return [
            ...recentSearches.map(value => ({ type: 'recent', value })),
            ...TRENDING_SEARCHES.map(value => ({ type: 'trending', value })),
        ];
    }, [recentSearches]);

    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSearch = useCallback((searchQuery: string) => {
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
            const updatedSearches = [
                trimmedQuery,
                ...recentSearches.filter(s => s !== trimmedQuery)
            ].slice(0, 5);

            setRecentSearches(updatedSearches);
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));

            router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
            onClose();
        }
    }, [recentSearches, router, onClose]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (query.length > 0) return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex(prev => {
                    const maxIndex = combinedItems.length - 1;
                    return prev >= maxIndex ? 0 : prev + 1;
                });
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex(prev => {
                    const maxIndex = combinedItems.length - 1;
                    return prev <= 0 ? maxIndex : prev - 1;
                });
            } else if (event.key === 'Enter') {
                event.preventDefault();
                setSelectedIndex(currentSelectedIndex => {
                    if (currentSelectedIndex >= 0 && combinedItems[currentSelectedIndex]) {
                        handleSearch(combinedItems[currentSelectedIndex].value);
                    }
                    return currentSelectedIndex;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, handleSearch, combinedItems, query]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            handleSearch(query);
        } else if (selectedIndex >= 0 && combinedItems[selectedIndex]) {
            handleSearch(combinedItems[selectedIndex].value);
        }
    };

    const removeRecentSearch = (searchTerm: string) => {
        const updated = recentSearches.filter(s => s !== searchTerm);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    };

    useEffect(() => {
        const isTypingNow = query.length > 0;
        setIsTyping(isTypingNow);
        if (isTypingNow) {
            setSelectedIndex(-1);
        }
    }, [query]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex justify-center items-start pt-[10vh] px-4"
        >
            <motion.div
                ref={modalRef}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200/20 dark:border-gray-700/30"
                style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)' }}
            >
                <form onSubmit={handleSubmit} className="relative">
                    <div className="relative flex items-center px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50">
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isTyping ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                        />
                        <div className="relative text-gray-400 dark:text-gray-500 mr-4 transition-colors duration-200" style={{ color: isTyping ? '#6366f1' : undefined }}>
                            <SearchIcon />
                        </div>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="검색어를 입력하세요..."
                            className="relative flex-1 text-lg bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                            autoComplete="off"
                        />
                        <AnimatePresence>
                            {query && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                >
                                    <CloseIcon />
                                </motion.button>
                            )}
                        </AnimatePresence>
                        <motion.kbd
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="relative ml-3 hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-sm"
                        >
                            ESC
                        </motion.kbd>
                    </div>
                </form>

                <div className="max-h-[400px] overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {!isTyping ? (
                            <motion.div
                                key="suggestion-list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="divide-y divide-gray-100 dark:divide-gray-800" // 섹션 구분을 위한 구분선 추가
                            >
                                {/* --- 최근 검색 섹션 --- */}
                                {recentSearches.length > 0 && (
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                                <ClockIcon />
                                                <span>최근 검색</span>
                                            </div>
                                            <button onClick={clearRecentSearches} className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
                                                모두 지우기
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {recentSearches.map((value, index) => {
                                                const isSelected = selectedIndex === index;
                                                // [참고] 기존 최근 검색 아이템 렌더링 JSX를 그대로 사용합니다.
                                                return (
                                                    <motion.div
                                                        key={`recent-${value}`}
                                                        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                                                        onClick={() => handleSearch(value)}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                    >
                                                        <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">{value}</span>
                                                        <button onClick={(e) => { e.stopPropagation(); removeRecentSearch(value); }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-all">
                                                            <CloseIcon />
                                                        </button>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* --- 인기 검색어 섹션 --- */}
                                {TRENDING_SEARCHES.length > 0 && (
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                            <TrendingIcon />
                                            <span>인기 검색어</span>
                                        </div>
                                        <div className="space-y-1">
                                            {TRENDING_SEARCHES.map((value, index) => {
                                                // [중요] 실제 인덱스 계산 (최근 검색어 개수 + 현재 인덱스)
                                                const actualIndex = recentSearches.length + index;
                                                const isSelected = selectedIndex === actualIndex;
                                                // [참고] 기존 인기 검색어 아이템 렌더링 JSX를 그대로 사용합니다.
                                                return (
                                                    <motion.div
                                                        key={`trending-${value}`}
                                                        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                                                        onClick={() => handleSearch(value)}
                                                        onMouseEnter={() => setSelectedIndex(actualIndex)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-sm font-bold min-w-[20px] ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500/70 dark:text-indigo-400/70'}`}>{index + 1}</span>
                                                            <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">{value}</span>
                                                        </div>
                                                        <motion.div initial={{ x: 0 }} animate={{ x: isSelected ? 5 : 0 }} transition={{ type: "spring", stiffness: 400 }} className={`transition-colors ${isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-600'}`}>
                                                            <ArrowRightIcon />
                                                        </motion.div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            query.length > 2 && (
                                <motion.div key="search-prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-8 text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd>를 눌러 &quot;{query}&quot; 검색
                                    </p>
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>
                </div>

                <div className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px]">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px]">↓</kbd>
                            <span>탐색</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px]">Enter</kbd>
                            <span>선택</span>
                        </span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}