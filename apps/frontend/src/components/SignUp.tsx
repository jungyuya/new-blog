// apps/frontend/src/components/SignUp.tsx 
'use client';

import { useState } from 'react';

export default function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        console.log("--- DEBUG ---");
        console.log("NEXT_PUBLIC_API_ENDPOINT:", process.env.NEXT_PUBLIC_API_ENDPOINT);
        console.log("--- END DEBUG ---");

        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        // [핵심] 환경 변수에서 백엔드의 "진짜 주소"를 가져옵니다.
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_ENDPOINT;
        if (!apiBaseUrl) {
            setError('API 엔드포인트가 설정되지 않았습니다.');
            setIsLoading(false);
            return;
        }

        // URL 객체를 사용하여, base URL 끝에 /가 있든 없든 상관없이 올바른 경로를 만듭니다.
        const apiUrl = new URL('api/auth/signup', apiBaseUrl).toString();
        console.log(`Requesting to: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '회원가입에 실패했습니다.');
            }

            setSuccess('회원가입에 성공했습니다! 이메일을 확인하여 계정을 활성화해주세요.');

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
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center text-gray-900">회원가입</h2>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        이메일 주소
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        비밀번호
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                    >
                        {isLoading ? '가입하는 중...' : '가입하기'}
                    </button>
                </div>
                {error && <p className="text-sm text-center text-red-600">{error}</p>}
                {success && <p className="text-sm text-center text-green-600">{success}</p>}
            </form>
        </div>
    );
}