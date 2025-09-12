// 파일 위치: apps/frontend/src/hooks/useLike.ts (신규 생성)
'use client';

import { useState, useTransition } from 'react';
import { Post, api } from '@/utils/api';

// useLike 훅이 반환할 값들의 타입을 정의합니다.
interface LikeState {
  likeCount: number;
  isLiked: boolean;
}

/**
 * '좋아요' 기능과 관련된 상태 및 로직을 관리하는 커스텀 훅입니다.
 * 낙관적 업데이트를 사용하여 최상의 사용자 경험을 제공합니다.
 * @param initialPost - '좋아요' 기능을 적용할 초기 게시물 데이터
 * @returns { likeCount, isLiked, handleLike, isPending } - 좋아요 수, 현재 좋아요 상태, 좋아요 클릭 핸들러, 처리 중 상태
 */
export function useLike(initialPost: Post) {
  // 1. 상태 관리: 서버로부터 받은 초기 데이터를 기반으로 '좋아요' 상태를 초기화합니다.
  const [likeState, setLikeState] = useState<LikeState>({
    likeCount: initialPost.likeCount || 0,
    isLiked: initialPost.isLiked || false,
  });

  // 2. 동시성 관리: useTransition 훅을 사용하여 UI 업데이트로 인한 앱의 버벅임을 방지합니다.
  // isPending은 서버 요청이 처리 중인지 여부를 나타냅니다.
  const [isPending, startTransition] = useTransition();

  // 3. '좋아요' 버튼 클릭 시 실행될 핸들러 함수
  const handleLike = async () => {
    // 이미 다른 요청이 처리 중이면 중복 실행을 방지합니다.
    if (isPending) return;

    startTransition(async () => {
      // 4. 낙관적 업데이트 (Optimistic Update)
      // 서버 응답을 기다리지 않고, UI를 즉시 업데이트합니다.
      const previousState = likeState; // 실패 시 롤백을 위해 이전 상태를 저장
      setLikeState((prev) => ({
        likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
        isLiked: !prev.isLiked,
      }));

      try {
        // 5. 서버에 API 요청을 보냅니다.
        const result = await api.toggleLike(initialPost.postId);

        // 6. 요청 성공 시, 서버가 보내준 최종 데이터로 상태를 한번 더 동기화합니다.
        // (다른 사용자가 동시에 '좋아요'를 누른 경우 등을 반영)
        setLikeState({
          likeCount: result.likeCount,
          isLiked: result.isLiked,
        });
      } catch (error) {
        // 7. 요청 실패 시, UI를 이전 상태로 롤백합니다.
        console.error("Failed to toggle like:", error);
        setLikeState(previousState);
        // (선택사항) 사용자에게 에러 알림을 표시할 수 있습니다. (예: toast 라이브러리)
      }
    });
  };

  return {
    likeCount: likeState.likeCount,
    isLiked: likeState.isLiked,
    handleLike,
    isPending, // 버튼을 비활성화하거나 로딩 스피너를 보여주는 데 사용할 수 있습니다.
  };
}