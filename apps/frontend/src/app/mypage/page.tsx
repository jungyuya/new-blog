// 파일 위치: apps/frontend/src/app/mypage/page.tsx (v1.1 - 비동기 문제 해결 최종본)
'use client';

import { useState, useEffect, useRef, } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import { api } from '@/utils/api';

// 페이지 진입점 컴포넌트
export default function MyPage() {
    return (
        <ProtectedRoute>
            <MyPageForm />
        </ProtectedRoute>
    );
}

// 실제 폼 로직을 담고 있는 컴포넌트
function MyPageForm() {
    const { user, setUser, } = useAuth();

    // 폼 입력 값을 위한 상태
    const [nickname, setNickname] = useState('');
    const [bio, setBio] = useState('');

    // [수정] 이미지 URL 상태를 '화면 표시용'과 'DB 저장용'으로 분리
    const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(null);
    const [finalAvatarUrl, setFinalAvatarUrl] = useState<string | null>(null);

    // UI 상태를 위한 상태
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 파일 입력을 위한 ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 컴포넌트가 마운트되거나 user 객체가 변경될 때, 폼의 상태를 초기화합니다.
    useEffect(() => {
        if (user) {
            setNickname(user.nickname || '');
            setBio(user.bio || '');
            setDisplayAvatarUrl(user.avatarUrl || null);
            setFinalAvatarUrl(user.avatarUrl || null);
        }
    }, [user]);

    // --- 프로필 사진 변경 핸들러 ---
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const MAX_FILE_SIZE_MB = 10;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError(`이미지 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다.`);
            return;
        }

        setIsUploading(true);
        setError(null);

        const tempUrl = URL.createObjectURL(file);
        setDisplayAvatarUrl(tempUrl); // 화면 표시용 URL을 임시 URL로 즉시 업데이트

        try {
            const { presignedUrl, publicUrl } = await api.getPresignedUrl(file.name);

            await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });

            // S3 업로드 성공 후, '저장용' URL 상태만 최종 S3 URL로 업데이트
            setFinalAvatarUrl(publicUrl);

        } catch (err) {
            console.error('Image upload failed:', err);
            setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
            setDisplayAvatarUrl(user?.avatarUrl || null); // 실패 시 원래 이미지로 복원
        } finally {
            setIsUploading(false);
            // 임시 URL은 컴포넌트가 언마운트될 때 정리하는 것이 더 안전합니다.
            // useEffect의 cleanup 함수를 활용할 수 있습니다.
        }
    };

    // --- 폼 제출 핸들러 ---
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const profileData = {
                nickname,
                bio: bio || '',
                avatarUrl: finalAvatarUrl || '',
            };

            // 1. API를 호출하고, 응답으로 업데이트된 'profile' 객체를 받습니다.
            const { profile: updatedProfile } = await api.updateMyProfile(profileData);

            alert('프로필이 성공적으로 업데이트되었습니다.');

            // 2. [핵심] AuthContext의 setUser를 직접 호출하여 전역 상태를 즉시 업데이트합니다.
            //    이전 user 상태(prevUser)를 기반으로, 변경된 프로필 정보만 덮어씁니다.
            //    이렇게 하면 id, email, groups와 같은 다른 정보들이 유실되지 않습니다.
            setUser((prevUser) => {
                if (!prevUser) return null; // 이전 사용자가 없으면 null 반환
                return {
                    ...prevUser,
                    nickname: updatedProfile.nickname,
                    bio: updatedProfile.bio,
                    avatarUrl: updatedProfile.avatarUrl,
                };
            });

        } catch (err) {
            console.error('Profile update failed:', err);
            setError(err instanceof Error ? err.message : '프로필 업데이트에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // user 정보가 로딩 중일 때 보여줄 UI
    if (!user) {
        return <div className="text-center p-8">사용자 정보를 불러오는 중...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">프로필 설정</h1>
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* --- 프로필 사진 영역 --- */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">프로필 사진</label>
                    <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                            <Image
                                src={displayAvatarUrl || '/default-avatar.png'}
                                alt="프로필 사진"
                                fill
                                className="object-cover"
                                key={displayAvatarUrl} // key를 주어 src 변경 시 리렌더링을 강제
                            />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/png, image/jpeg, image/gif"
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                            {isUploading ? '업로드 중...' : '이미지 변경'}
                        </button>
                    </div>
                </div>

                {/* --- 닉네임 입력 영역 --- */}
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

                {/* --- 자기소개 입력 영역 --- */}
                <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700">자기소개</label>
                    <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                </div>

                {error && <p className="text-red-500 text-center">{error}</p>}

                {/* --- 저장 버튼 --- */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting || isUploading}
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        {isSubmitting ? '저장 중...' : '프로필 저장'}
                    </button>
                </div>
            </form>
        </div>
    );
}