// 파일 위치: apps/frontend/src/app/mypage/page.tsx (v1.0 - 최종본)
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import { api } from '@/utils/api';

// 실제 폼 로직을 담고 있는 컴포넌트
function MyPageForm() {
  // [수정] checkUserStatus 대신 refreshUser를 가져옵니다.
  const { user, refreshUser } = useAuth();
  
  // 폼 입력 값을 위한 상태
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
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
      setAvatarUrl(user.avatarUrl || null);
    }
  }, [user]);

  // --- [핵심] 프로필 사진 변경 핸들러 ---
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_MB = 5; // 5MB 제한
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`이미지 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다.`);
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      // 1. 백엔드에 Presigned URL 요청
      const { presignedUrl, publicUrl } = await api.getPresignedUrl(file.name);

      // 2. S3에 직접 이미지 업로드
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!response.ok) {
        throw new Error('S3에 이미지를 업로드하는 데 실패했습니다.');
      }

      // 3. 업로드 성공 시, avatarUrl 상태를 업데이트하여 미리보기를 변경
      setAvatarUrl(publicUrl);

    } catch (err) {
      console.error('Image upload failed:', err);
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // --- [핵심] 폼 제출 핸들러 ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.updateMyProfile({
        nickname,
        bio: bio || '',
        // avatarUrl이 null이 아닐 경우에만 전송
        ...(avatarUrl && { avatarUrl: avatarUrl }),
      });
      alert('프로필이 성공적으로 업데이트되었습니다.');
      // [핵심] AuthContext의 user 상태를 최신 정보로 갱신합니다.
      await refreshUser(); 
    } catch (err) {
      console.error('Profile update failed:', err);
      setError(err instanceof Error ? err.message : '프로필 업데이트에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // user 정보가 로딩 중일 때 보여줄 UI
  if (!user) {
    return <div>사용자 정보를 불러오는 중...</div>;
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
                // avatarUrl이 null이면 기본 이미지를 사용합니다.
                src={avatarUrl || '/default-avatar.png'} 
                alt="프로필 사진"
                fill
                className="object-cover"
                // 외부 URL(S3) 이미지를 사용하므로, key를 주어 변경 시 리렌더링을 강제합니다.
                key={avatarUrl} 
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

// 페이지 진입점 컴포넌트
export default function MyPage() {
  return (
    <ProtectedRoute>
      <MyPageForm />
    </ProtectedRoute>
  );
}