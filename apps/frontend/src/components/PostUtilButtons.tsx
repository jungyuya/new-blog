// 파일 위치: apps/frontend/src/components/PostUtilButtons.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Post, AdjacentPost, api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLike } from '@/hooks/useLike';
import { motion, AnimatePresence } from 'framer-motion';
import SummaryModal from './SummaryModal'; // SummaryModal import



// 아이콘 컴포넌트 (SVG) - 파일 내부에 직접 정의하여 외부 의존성을 줄입니다.
const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);

const ListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

// 화살표 아이콘 추가
const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);
const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);

// '좋아요'를 위한 하트 아이콘을 추가합니다.
const HeartIcon = ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill={filled ? 'currentColor' : 'none'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.5l1.318-1.182a4.5 4.5 0 116.364 6.364L12 21l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);

// 깃허브 링크 버튼
const GitHubIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
);

// [신규] 컴포넌트가 받을 props 타입 정의
interface PostUtilButtonsProps {
    post: Post;
    prevPost: AdjacentPost | null;
    nextPost: AdjacentPost | null;
}

export default function PostUtilButtons({ post, prevPost, nextPost }: PostUtilButtonsProps) {
    const { user } = useAuth(); // 로그인 상태 확인
    const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

    // --- AI 요약 모달 관련 상태 관리 ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [summary, setSummary] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const { likeCount, isLiked, handleLike, isPending } = useLike(post);
    const handleCopyLink = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    setCopyStatus('copied');
                    setTimeout(() => setCopyStatus('idle'), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy link: ', err);
                    alert('링크 복사에 실패했습니다. 다시 시도해주세요.');
                });
        } else {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = window.location.href;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopyStatus('copied');
                setTimeout(() => setCopyStatus('idle'), 2000);
            } catch (err) {
                console.error('Fallback copy failed: ', err);
                alert('링크 복사에 실패했습니다. 브라우저가 이 기능을 지원하지 않을 수 있습니다.');
            }
        }
    };

    const handleSummaryClick = async () => {
        setIsModalOpen(true);
        setIsLoadingSummary(true);
        setSummary(''); // 이전 요약 내용 초기화
        try {                                     //fake time zz
            await new Promise(resolve => setTimeout(resolve, 500));
            const result = await api.fetchSummary(post.postId);
            setSummary(result.summary);
        } catch (err) {
            console.error('Failed to fetch summary:', err);
            setSummary('요약을 생성하는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsLoadingSummary(false);
        }
    };

    const [direction, setDirection] = useState(0);
    const [animationKey, setAnimationKey] = useState(0);

    const wrappedHandleLike = () => {
        // isLiked가 true이면 (즉, 취소할 것이므로) 숫자가 감소 -> direction = -1
        // isLiked가 false이면 (즉, 추가할 것이므로) 숫자가 증가 -> direction = 1
        setDirection(isLiked ? -1 : 1);
        handleLike();
        setAnimationKey(prevKey => prevKey + 1);
    };

    // [신규] likeCount의 자릿수에 따라 Tailwind 클래스를 반환하는 로직
    const getWidthClass = (count: number): string => {
        if (count < 10) return 'w-2.5';
        if (count < 100) return 'w-5';
        if (count < 1000) return 'w-7';
        return 'w-10';
    };
    const widthClass = getWidthClass(likeCount);
    return (
        <>
            <div className="my-12 pt-8 border-t border-gray-200">
                <div className="flex justify-between items-center">
                    {/* 왼쪽: 공유, GitHub, 좋아요, AI 요약 버튼 */}
                    <div className="flex items-center space-x-2">
                        {/* 공유 버튼  */}
                        <div className="relative">
                            <button
                                onClick={handleCopyLink}
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
                                aria-label="Share post"
                            >
                                <ShareIcon />
                            </button>
                            {copyStatus === 'copied' && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
                                    Copy OK!
                                </div>
                            )}
                        </div>

                        {/* GitHub 링크 버튼 */}
                        {githubUrl && (
                            <a
                                href={githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
                                aria-label="Visit my GitHub profile"
                            >
                                <GitHubIcon />
                            </a>
                        )}

                        {/* '좋아요' 버튼  */}
                        <button
                            onClick={wrappedHandleLike}
                            disabled={isPending}
                            className={`group flex items-center space-x-1.5 pl-3 pr-4 py-2 rounded-full transition-all duration-200 ease-in-out transform ${isLiked
                                ? 'text-red-500 bg-red-100 hover:bg-red-200'
                                : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                                } ${isPending ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                            aria-pressed={isLiked}
                            aria-label="Like this post"
                        >
                            <div
                                key={animationKey}
                                className={`transition-transform duration-200 ease-in-out ${isLiked ? 'animate-bouncy-heart' : ''}`}
                            >
                                <HeartIcon filled={isLiked} />
                            </div>
                            <div className={`relative ${widthClass} h-5 overflow-hidden text-center transition-all duration-300 ease-in-out`}>
                                <AnimatePresence initial={false} custom={direction}>
                                    <motion.span
                                        key={likeCount}
                                        className="absolute inset-0 font-semibold text-sm"
                                        variants={{
                                            enter: (direction: number) => ({ y: direction > 0 ? 15 : -15, opacity: 0 }),
                                            center: { y: 0, opacity: 1 },
                                            exit: (direction: number) => ({ y: direction > 0 ? -15 : 15, opacity: 0 }),
                                        }}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{ duration: 0.2 }}
                                        custom={direction}
                                    >
                                        {likeCount}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        </button>

                        {/* --- AI 요약 버튼의 아이콘 --- */}
                        <button
                            onClick={handleSummaryClick}
                            className="p-0.9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
                            aria-label="AI 요약 보기"
                        >
                            <Image
                                src="/ai-summary-icon.svg" // public 디렉토리의 파일 경로
                                alt="AI 요약 아이콘"
                                width={36}
                                height={36}
                            />
                        </button>
                    </div>

                    {/* 오른쪽: 목록 버튼  */}
                    <Link
                        href="/"
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
                        aria-label="Back to list"
                    >
                        <ListIcon />
                    </Link>
                </div>

                {/* 이전/다음 글 네비게이션  */}
                {(prevPost || nextPost) && (
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        {/* 이전 글 링크 */}
                        {prevPost ? (
                            <Link
                                href={`/posts/${prevPost.postId}`}
                                className="group flex items-center p-4 rounded-lg hover:bg-gradient-to-r from-gray-50 to-transparent transition-colors"
                            >
                                <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ease-in-out group-hover:-translate-x-1">
                                    <ArrowLeftIcon />
                                </div>
                                <div className="ml-4 overflow-hidden">
                                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                                        {prevPost.title}
                                    </p>
                                </div>
                            </Link>
                        ) : (
                            <div></div>
                        )}

                        {/* 다음 글 링크 */}
                        {nextPost ? (
                            <Link
                                href={`/posts/${nextPost.postId}`}
                                className="group flex items-center justify-end p-4 rounded-lg hover:bg-gradient-to-l from-gray-50 to-transparent transition-colors"
                            >
                                <div className="mr-4 overflow-hidden text-right">
                                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                                        {nextPost.title}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ease-in-out group-hover:translate-x-1">
                                    <ArrowRightIcon />
                                </div>
                            </Link>
                        ) : (
                            <div></div>
                        )}
                    </div>
                )}
            </div>

            {/* ---  모달 컴포넌트 렌더링 --- */}
            <SummaryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                summary={summary}
                isLoading={isLoadingSummary}
                postId={post.postId} // [신규] postId 전달
                
            />
        </>
    );
}