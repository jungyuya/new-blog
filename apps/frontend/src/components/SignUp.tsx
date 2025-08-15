// 파일 위치: apps/frontend/src/components/SignUp.tsx (리팩토링)
'use client';

import { useState } from 'react';
import { api } from '@/utils/api'; // [수정] 중앙 api 클라이언트를 import 합니다.
import { useRouter } from 'next/navigation'; // [추가] 성공 시 페이지 이동을 위해 import 합니다.

export default function SignUp() {
    const router = useRouter(); // [추가]
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
            // [수정] fetch 로직 전체를 api.signup 호출로 대체합니다.
            const data = await api.signup({ email, password });

            setSuccess(data.message || '회원가입에 성공했습니다! 2초 후 로그인 페이지로 이동합니다.');
            
            // [추가] 성공 시, 2초 후에 로그인 페이지로 자동 이동시켜 사용자 경험을 개선합니다.
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
        // [수정] 최상위 div는 페이지 컴포넌트에서 처리하므로 제거합니다.
        // 이렇게 해야 다른 페이지에서도 이 컴포넌트를 유연하게 재사용할 수 있습니다.
        <form className="space-y-6" onSubmit={handleSubmit}>
            {/* ... (기존 form 내용은 변경 없음) ... */}
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    E-mail
                </label>
                <input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                </label>
                <input
                    id="password" name="password" type="password" autoComplete="new-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div>
                <button
                    type="submit" disabled={isLoading}
                    className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                    {isLoading ? '가입하는 중...' : '가입하기'}
                </button>
            </div>
            {error && <p className="text-sm text-center text-red-600">{error}</p>}
            {success && <p className="text-sm text-center text-green-600">{success}</p>}
        </form>
    );
}