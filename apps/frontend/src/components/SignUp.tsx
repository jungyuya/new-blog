// apps/frontend/src/components/SignUp.tsx (신규 생성)
'use client';

import { useState } from 'react';

export default function SignUp() {
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

        // [핵심] 우리 백엔드 API의 /auth/signup 엔드포인트를 직접 호출합니다.
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                // 백엔드(Hono)에서 보낸 에러 메시지를 사용자에게 보여줍니다.
                throw new Error(data.message || '회원가입에 실패했습니다.');
            }

            setSuccess('회원가입에 성공했습니다! 이메일을 확인하여 계정을 활성화해주세요.');

        } catch (err) { // [핵심 수정] (err: any) 에서 (err)로 변경
            // TypeScript는 catch 블록의 에러를 기본적으로 'unknown' 타입으로 간주합니다.
            // 이것이 'any'보다 안전한 타입입니다.
            // err가 Error 객체인지 확인하고, 그렇다면 message 속성을 사용합니다.
            if (err instanceof Error) {
                setError(err.message);
            } else {
                // 에러가 Error 객체가 아닌 경우 (예: 문자열이 throw된 경우)
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