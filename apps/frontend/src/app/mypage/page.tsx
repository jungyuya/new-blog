// 파일 위치: apps/frontend/src/app/mypage/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';

// 페이지의 실제 내용을 담을 폼 컴포넌트
function MyPageForm() {
    const { user } = useAuth(); // checkUserStatus: 프로필 업데이트 후 상태 갱신용
    const router = useRouter();

    // --- 상태 관리 ---
    // 폼 입력을 위한 상태
    const [nickname, setNickname] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    // UI 제어를 위한 상태
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- 데이터 로딩 ---
    // 컴포넌트가 마운트될 때, AuthContext의 user 정보로 폼을 초기화합니다.
    useEffect(() => {
        if (user) {
            setNickname(user.nickname || user.email.split('@')[0] || '');
            setBio(user.bio || '');
            setAvatarUrl(user.avatarUrl || '/default-avatar.png'); // 기본 아바타 설정
            setIsLoading(false);
        }
    }, [user]); // user 객체가 변경될 때마다 실행

    // --- 핸들러 함수 ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            // [핵심] api.ts에 새로 만들 updateUserProfile 함수를 호출합니다.
            await api.updateUserProfile({ nickname, bio, avatarUrl });

            alert('프로필이 성공적으로 업데이트되었습니다.');

            // [핵심] 페이지를 새로고침하여 AuthContext가 최신 사용자 정보를 다시 불러오도록 합니다.
            // router.refresh()는 서버 데이터만 갱신하므로, window.location.reload()가 더 확실할 수 있습니다.
            window.location.reload();

        } catch (err) {
            console.error('Failed to update profile:', err);
            setError(err instanceof Error ? err.message : '프로필 업데이트에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- UI 렌더링 ---
    if (isLoading) {
        return <div>프로필 정보를 불러오는 중...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">프로필 수정</h1>
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 프로필 사진 UI (다음 단계에서 구현) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">프로필 사진</label>
                    <div className="mt-2 flex items-center gap-4">
                        <img
                            src={avatarUrl} // avatarUrl이 '/default-avatar.png'일 것입니다.
                            alt="프로필 사진"
                            width={96}
                            height={96}
                            className="rounded-full object-cover"
                        />
                        <button type="button" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">
                            이미지 변경
                        </button>
                    </div>
                </div>

                {/* 닉네임 입력 UI */}
                <div>
                    <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">닉네임</label>
                    <input
                        id="nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        required
                    />
                </div>

                {/* 자기소개 입력 UI */}
                <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700">자기소개</label>
                    <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                </div>

                {/* 저장 버튼 */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        {isSubmitting ? '저장 중...' : '프로필 저장'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// 페이지 진입점 컴포넌트
export default function MyPage() {
    return (
        <ProtectedRoute>
            <MyPageForm />
        </ProtectedRoute>
    );
}