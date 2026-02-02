'use client'; // 클라이언트 컴포넌트

import React, { useState, useEffect } from 'react';

interface DebouncedSkeletonProps {
    children: React.ReactNode;
    delay?: number; // 지연 시간 (기본값 200ms)
}

/**
 * Loading State의 깜빡임을 방지하기 위한 Debounced Skeleton
 * 지정된 delay 시간보다 로딩이 길어질 때만 children(스켈레톤)을 보여줍니다.
 * 
 * - Warm Start (100ms 이내): 스켈레톤 안 보임 -> 사용자 경험 좋음
 * - Cold Start (2000ms+): 스켈레톤 보임 -> "로딩 중" 인지
 */
const DebouncedSkeleton: React.FC<DebouncedSkeletonProps> = ({
    children,
    delay = 200 // 300ms는 너무 길 수 있어 200ms로 설정 (체감상 적절)
}) => {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldShow(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    if (!shouldShow) {
        return null; // 지연 시간 동안은 아무것도 보여주지 않음
    }

    return <>{children}</>;
};

export default DebouncedSkeleton;
