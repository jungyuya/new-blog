// 파일 위치: apps/frontend/src/components/Login.tsx
// 역할: 이메일/비밀번호 입력 폼을 렌더링하고, 로그인 API 호출을 처리하는 클라이언트 컴포넌트입니다.

'use client'; // [핵심] useState, form 이벤트 핸들러 등 브라우저 상호작용이 필요하므로 클라이언트 컴포넌트로 선언합니다.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api'; // 우리가 만든 중앙 API 클라이언트를 import 합니다.

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // 폼 제출 시 페이지가 새로고침되는 기본 동작을 막습니다.
    setError(null);
    setIsLoading(true);

    try {
      // [핵심] api.ts에 정의한 login 함수를 호출합니다.
      // 이제 우리는 fetch의 상세 옵션(credentials 등)을 신경 쓸 필요가 없습니다.
      await api.login({ email, password });

      // 로그인 성공 시, 홈페이지로 리다이렉트합니다.
      // router.push('/')를 사용하면 클라이언트 사이드에서 부드럽게 페이지가 전환됩니다.
      router.push('/');
      
      // [선택사항] 페이지 이동 후에도 상태가 유지될 수 있으므로,
      // 새로고침을 통해 깨끗한 상태에서 시작하게 할 수도 있습니다.
      // window.location.href = '/';

    } catch (err: any) {
      // api.ts에서 throw한 에러를 여기서 잡습니다.
      console.error('Login failed:', err);
      setError(err.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      // 성공/실패 여부와 관계없이 로딩 상태를 해제합니다.
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          ✉️E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
         🔑Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </form>
  );
}