// 파일 위치: apps/frontend/src/components/SignUp.tsx
'use client';

import { useState } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/navigation';

export default function SignUp() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const data = await api.signup({ email, password });
            setSuccess(data.message || '회원가입에 성공했습니다! 2초 후 로그인 페이지로 이동합니다.');
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('알 수 없는 오류가 발생했습니다.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
                {/* [수정] 1. 라벨에 다크 모드 색상 적용 */}
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    E-mail
                </label>
                {/* [수정] 2. input에 다크 모드 스타일 적용 */}
                <input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                />
            </div>
            <div>
                {/* [수정] 1. 라벨에 다크 모드 색상 적용 */}
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                </label>
                {/* [수정] 2. input에 다크 모드 스타일 적용 */}
                <input
                    id="password" name="password" type="password" autoComplete="new-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                />
            </div>
            <div>
                {/* [수정] 3. 버튼의 비활성화 상태에 다크 모드 스타일 적용 */}
                <button
                    type="submit" disabled={isLoading}
                    className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                >
                    {isLoading ? '가입하는 중...' : '가입하기'}
                </button>
            </div>
            {/* [수정] 4. 성공/에러 메시지에 다크 모드 색상 적용 */}
            {error && <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-sm text-center text-green-600 dark:text-green-400">{success}</p>}
        </form>
    );
}