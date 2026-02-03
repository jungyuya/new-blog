// 파일 위치: apps/frontend/src/components/PostUtilButtons.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Post, AdjacentPost, api } from '@/utils/api';
import { useLike } from '@/hooks/useLike';
import { motion, AnimatePresence } from 'framer-motion';
import SummaryModal from './SummaryModal'; // SummaryModal import
import AudioPlayer from './AudioPlayer';



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
    const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

    // --- AI 요약 모달 관련 상태 관리 ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [summary, setSummary] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    // [신규] 공유 메뉴 상태 관리
    const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
    const toggleShareMenu = () => setIsShareMenuOpen(!isShareMenuOpen);

    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const { likeCount, isLiked, handleLike, isPending } = useLike(post);
    const handleCopyLink = () => {
        const copyToClipboard = (text: string) => {
            if (navigator.clipboard) {
                return navigator.clipboard.writeText(text);
            } else {
                return new Promise<void>((resolve, reject) => {
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            }
        };

        copyToClipboard(window.location.href)
            .then(() => {
                setCopyStatus('copied');
                setTimeout(() => {
                    setCopyStatus('idle');
                    setIsShareMenuOpen(false); // 복사 완료 후 메뉴 닫기
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy link: ', err);
                alert('링크 복사에 실패했습니다.');
            });
    };

    // [신규] 카카오톡 공유 핸들러 (분리됨)
    const handleKakaoShare = () => {
        const Kakao = (window as any).Kakao;

        // SDK가 로드되지 않았거나 초기화되지 않은 경우 처리
        if (!Kakao || !Kakao.isInitialized()) {
            // 키가 있다면 초기화 시도
            if (process.env.NEXT_PUBLIC_KAKAO_API_KEY) {
                try {
                    // SDK가 로드되었으나 초기화가 안 된 경우 (window.Kakao 존재)
                    if (Kakao) {
                        Kakao.init(process.env.NEXT_PUBLIC_KAKAO_API_KEY);
                    } else {
                        // SDK 스크립트 자체가 로드되지 않음
                        alert('카카오톡 SDK가 로드되지 않았습니다. 새로고침 후 다시 시도해주세요.');
                        return;
                    }
                } catch (e) {
                    console.error('Kakao init check failed', e);
                    // 이미 초기화 된 경우 에러 무시하고 넘어감
                }
            } else {
                alert('카카오톡 공유를 위한 API 키 설정이 필요합니다.');
                return;
            }
        }

        Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: post.title,
                description: post.summary || '이 글을 공유해보세요!',
                imageUrl: post.thumbnailUrl || 'https://blog.kakaocdn.net/dn/bE8tYf/btsHw5yJc3Q/M3K9vK9l7X5i4x7u9q8w/img.png',
                link: {
                    mobileWebUrl: window.location.href,
                    webUrl: window.location.href,
                },
            },
            buttons: [
                {
                    title: '글 보러가기',
                    link: {
                        mobileWebUrl: window.location.href,
                        webUrl: window.location.href,
                    },
                },
            ],
        });
        setIsShareMenuOpen(false); // 공유 창이 뜨면 메뉴 닫기
    };

    const handleSummaryClick = async () => {
        setIsModalOpen(true);
        setIsLoadingSummary(true);
        setSummary(''); // 이전 요약 내용 초기화
        try {                                     //fake time 0.5 zz
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


    // --- 오디오 플레이어 상태 관리 ---
    const [showPlayer, setShowPlayer] = useState(false);

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
            {/* [수정] 1. 최상위 컨테이너의 상단 테두리에 다크 모드 색상 적용 */}
            <div className="my-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        {/* [UX 변경] 공유 메뉴 (팝업 형태) */}
                        <div className="relative">
                            <button
                                onClick={toggleShareMenu}
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                                aria-label="Share post options"
                                aria-expanded={isShareMenuOpen}
                            >
                                <ShareIcon />
                            </button>

                            {/* 말풍선 팝업 메뉴 */}
                            <AnimatePresence>
                                {isShareMenuOpen && (
                                    <>
                                        {/* 외부 클릭 감지용 투명 오버레이 */}
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsShareMenuOpen(false)}
                                        />

                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-20 w-max bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 flex items-center gap-2"
                                        >
                                            {/* 말풍선 화살표 */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 border-8 border-transparent border-t-white dark:border-t-gray-800" />

                                            {/* 링크 복사 버튼 */}
                                            <button
                                                onClick={handleCopyLink}
                                                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group min-w-[60px]"
                                            >
                                                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                </div>
                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">링크 복사</span>
                                            </button>

                                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

                                            {/* 카카오톡 공유 버튼 */}
                                            <button
                                                onClick={handleKakaoShare}
                                                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group min-w-[60px]"
                                            >
                                                <div className="p-1 bg-[#FEE500] rounded-full group-hover:bg-[#fdd835] transition-colors">
                                                    <img
                                                        src="https://developers.kakao.com/assets/img/about/logos/kakaotalksharing/kakaotalk_sharing_btn_small.png"
                                                        alt="Kakao"
                                                        className="w-7 h-7"
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">카카오톡</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>

                            {/* 복사 완료 토스트 (공유 버튼 근처에 표시) */}
                            <AnimatePresence>
                                {copyStatus === 'copied' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-md shadow-lg whitespace-nowrap z-30"
                                    >
                                        ✓ 링크가 복사되었습니다
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* GitHub 링크 버튼 */}
                        {githubUrl && (
                            <a
                                href={githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                // [수정] 2. 기본 아이콘 버튼에 다크 모드 스타일 적용
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                                aria-label="Visit my GitHub profile"
                            >
                                <GitHubIcon />
                            </a>
                        )}

                        {/* '좋아요' 버튼 (Ripple Effect 적용) */}
                        <button
                            onClick={(e) => {
                                // Ripple Effect
                                const button = e.currentTarget;
                                const circle = document.createElement('span');
                                const diameter = Math.max(button.clientWidth, button.clientHeight);
                                const radius = diameter / 2;

                                circle.style.width = circle.style.height = `${diameter}px`;
                                circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
                                circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
                                circle.classList.add('ripple');

                                const ripple = button.getElementsByClassName('ripple')[0];
                                if (ripple) {
                                    ripple.remove();
                                }

                                button.appendChild(circle);

                                // 기존 핸들러 실행
                                wrappedHandleLike();
                            }}
                            disabled={isPending}
                            className={`group relative overflow-hidden flex items-center space-x-1.5 pl-3 pr-4 py-2 rounded-full transition-all duration-200 ease-in-out transform ${isLiked
                                ? 'text-red-500 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/50 dark:hover:bg-red-900'
                                : 'text-gray-500 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600'
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

                            {/* Ripple Style */}
                            <style jsx global>{`
                                span.ripple {
                                    position: absolute;
                                    border-radius: 50%;
                                    transform: scale(0);
                                    animation: ripple 0.6s linear;
                                    background-color: rgba(255, 255, 255, 0.7);
                                }

                                @keyframes ripple {
                                    to {
                                        transform: scale(4);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        </button>


                        {/* --- AI 요약 버튼의 아이콘 --- */}
                        <button
                            onClick={handleSummaryClick}
                            // [수정] 2. 기본 아이콘 버튼에 다크 모드 스타일 적용
                            className="p-0.9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                            aria-label="AI 요약 보기"
                        >
                            <Image src="/ai-summary-icon.svg" alt="AI 요약 아이콘" width={36} height={36} />
                        </button>



                        {/* --- '음성으로 듣기' 버튼 --- */}
                        {post.speechUrl && (
                            <button
                                onClick={() => setShowPlayer(!showPlayer)} // [수정] 플레이어 표시를 토글
                                // 버튼의 패딩을 조정하여 이미지 주변에 적절한 여백을 줍니다.
                                className="p-1.3 rounded-full hover:bg-gray-100 transition-colors duration-200 dark:hover:bg-gray-700"
                                aria-label="음성으로 듣기 (Polly)"
                            >
                                <Image
                                    src="/polly-tts-icon.png" // public 폴더에 추가한 파일 경로
                                    alt="Polly 음성으로 듣기 아이콘"
                                    width={36}  // 표시될 아이콘의 너비 (36px인 AI 요약 아이콘보다 약간 작게 설정)
                                    height={36} // 표시될 아이콘의 높이
                                    className="rounded-full" // 아이콘이 원형일 경우 가장자리를 부드럽게 처리
                                    unoptimized
                                />
                            </button>
                        )}
                    </div>

                    {/* 오른쪽: 목록 버튼  */}
                    <Link
                        href="/"
                        // [수정] 2. 기본 아이콘 버튼에 다크 모드 스타일 적용
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                        aria-label="Back to list"
                    >
                        <ListIcon />
                    </Link>
                </div>

                {/* --- [신규] 오디오 플레이어 UI (조건부 렌더링) --- */}
                <AudioPlayer post={post} showPlayer={showPlayer} />

                {/* 이전/다음 글 네비게이션  */}
                {(prevPost || nextPost) && (
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        {prevPost ? (
                            <Link
                                href={`/posts/${prevPost.postId}`}
                                // [수정] 4. 이전/다음 글 링크에 다크 모드 스타일 적용
                                className="group flex items-center p-4 rounded-lg hover:bg-gradient-to-r from-gray-50 to-transparent transition-colors dark:hover:bg-gradient-to-r dark:from-gray-800/50"
                            >
                                <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ease-in-out group-hover:-translate-x-1 dark:text-gray-500 dark:group-hover:text-gray-300">
                                    <ArrowLeftIcon />
                                </div>
                                <div className="ml-4 overflow-hidden">
                                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 truncate dark:text-gray-300 dark:group-hover:text-blue-400">
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
                                // [수정] 4. 이전/다음 글 링크에 다크 모드 스타일 적용
                                className="group flex items-center justify-end p-4 rounded-lg hover:bg-gradient-to-l from-gray-50 to-transparent transition-colors dark:hover:bg-gradient-to-l dark:from-gray-800/50"
                            >
                                <div className="mr-4 overflow-hidden text-right">
                                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 truncate dark:text-gray-300 dark:group-hover:text-blue-400">
                                        {nextPost.title}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ease-in-out group-hover:translate-x-1 dark:text-gray-500 dark:group-hover:text-gray-300">
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
                postId={post.postId}
            />
        </>
    );
}