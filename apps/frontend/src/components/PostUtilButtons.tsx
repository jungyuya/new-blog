// 파일 위치: apps/frontend/src/components/PostUtilButtons.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AdjacentPost } from '@/utils/api'; // AdjacentPost 타입 import


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

// [신규] 컴포넌트가 받을 props 타입 정의
interface PostUtilButtonsProps {
    prevPost: AdjacentPost | null;
    nextPost: AdjacentPost | null;
}

export default function PostUtilButtons({ prevPost, nextPost }: PostUtilButtonsProps) {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

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

    return (
        // [수정] 최상위 div의 border를 상단(t)만 남기고, 하단(y) 패딩을 제거하여 구조를 변경합니다.
        <div className="my-12 pt-8 border-t border-gray-200">
            <div className="flex justify-between items-center">
                {/* 왼쪽: 공유 버튼 */}
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

                {/* 오른쪽: 목록 버튼 */}
                <Link
                    href="/"
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
                    aria-label="Back to list"
                >
                    <ListIcon />
                </Link>
            </div>

            {/* --- [핵심 수정] 이전/다음 글 네비게이션 UI 전체 변경 --- */}
            {(prevPost || nextPost) && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {/* 이전 글 링크 */}
                    {prevPost ? (
                        <Link 
                          href={`/posts/${prevPost.postId}`} 
                          // --- [핵심 수정] hover:bg-gray-50을 그라데이션 클래스로 교체 ---
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
                          // --- [핵심 수정] hover:bg-gray-50을 그라데이션 클래스로 교체 ---
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
    );
}