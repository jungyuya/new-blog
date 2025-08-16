// 파일 위치: apps/frontend/src/components/Login.tsx (v2.0 리팩토링)
// 역할: UI 렌더링과 사용자 입력 처리에만 집중하는 단순화된 컴포넌트.

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation'; // [추가] useRouter를 다시 import 합니다.

export default function Login() {
  // [수정] AuthContext에서 login 함수와 isLoading 상태를 직접 가져옵니다.
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // [수정] 자체 로딩 상태 대신 AuthContext의 로딩 상태를 사용할 수도 있지만,
  // UI의 즉각적인 피드백을 위해 독립적인 로딩 상태를 유지합니다.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 1. AuthContext의 login 함수를 호출합니다.
      await login({ email, password });
      
      // 2. [핵심] login 함수가 에러 없이 성공적으로 완료되면,
      //   이곳에서 명시적으로 페이지 이동을 실행합니다.
      router.push('/');

    } catch (err) {
      console.error('Login failed:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // [수정] disabled 속성에서 isAuthLoading 대신 isSubmitting을 사용합니다.
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ... (input 태그들은 변경 없음) ... */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>
      )}
      <div>
        <button type="submit" disabled={isSubmitting}
          className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </form>
  );
}