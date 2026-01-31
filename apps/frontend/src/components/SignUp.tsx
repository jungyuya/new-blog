// 파일 위치: apps/frontend/src/components/SignUp.tsx
'use client';

import { useState } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">Create Account</h3>
                <p className="text-blue-100/60 text-sm">Join the portal and start your deep dive journey.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-blue-200/70 mb-1.5 ml-1">
                        Email Address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-sm"
                        placeholder="your@email.com"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-blue-200/70 mb-1.5 ml-1">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-sm"
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-md">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-3 text-sm text-green-200 bg-green-500/20 border border-green-500/30 rounded-xl backdrop-blur-md">
                        {success}
                    </div>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="liquid group relative flex justify-center w-full px-4 py-3.5 text-sm font-bold text-white bg-blue-600/80 hover:bg-blue-500 border border-blue-400/30 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center">
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Register Account'
                            )}
                        </span>
                    </button>
                </div>

                <div className="text-center text-sm pt-2">
                    <span className="text-blue-100/50">이미 계정이 있으신가요? </span>
                    <Link href="/login" className="font-bold text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline">
                        로그인
                    </Link>
                </div>
            </form>
        </div>
    );
}