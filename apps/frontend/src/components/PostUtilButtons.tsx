// 파일 위치: apps/frontend/src/components/PostUtilButtons.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

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

export default function PostUtilButtons() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const handleCopyLink = () => {
    // navigator.clipboard는 HTTPS 또는 localhost 환경에서만 사용 가능합니다.
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          setCopyStatus('copied');
          // 2초 후에 다시 원래 상태로 되돌립니다.
          setTimeout(() => setCopyStatus('idle'), 2000);
        })
        .catch(err => {
          console.error('Failed to copy link: ', err);
          alert('링크 복사에 실패했습니다. 다시 시도해주세요.');
        });
    } else {
      // HTTPS가 아닌 환경(예: http://localhost)을 위한 폴백(fallback)
      // 이 방식은 구식이며, 사용자 경험이 좋지 않으므로 최후의 수단입니다.
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
    <div className="my-12 py-8 border-t border-gray-200 flex justify-between items-center">
      {/* 왼쪽: 공유 버튼 */}
      <div className="relative">
        <button
          onClick={handleCopyLink}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-200"
          aria-label="Share post"
        >
          <ShareIcon />
        </button>
        {/* 복사 완료 피드백 메시지 (Toast) */}
        {copyStatus === 'copied' && (
          // --- [핵심 수정] whitespace-nowrap 클래스를 추가합니다. ---
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
  );
}