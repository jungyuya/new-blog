'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 에러 발생 시 콘솔에 로그 출력 (추후 Sentry 등으로 확장 가능)
        console.error('Runtime Error:', error);
    }, [error]);

    return (
        <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-6">
                <AlertTriangle className="w-12 h-12 text-red-500 dark:text-red-400" />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                문제가 발생했습니다
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
                페이지를 불러오는 도중 예기치 않은 오류가 발생했습니다.
                <br />
                일시적인 문제일 수 있으니 다시 시도해 주세요.
            </p>

            {/* 개발 환경에서만 에러 상세 내용 표시 */}
            {process.env.NODE_ENV === 'development' && (
                <div className="w-full max-w-2xl bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-left overflow-auto mb-8 border border-gray-200 dark:border-gray-700">
                    <p className="font-mono text-sm text-red-600 dark:text-red-400 break-all">
                        {error.message}
                    </p>
                    {error.digest && (
                        <p className="mt-2 text-xs text-gray-500">Digest: {error.digest}</p>
                    )}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={reset}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" />
                    다시 시도하기
                </button>

                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors"
                >
                    <Home className="w-4 h-4" />
                    홈으로 돌아가기
                </Link>
            </div>
        </div>
    );
}
