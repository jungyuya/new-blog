// 파일 위치: apps/frontend/src/app/login/page.tsx
// 역할: /login 경로에 해당하는 페이지를 정의하고, 로그인 폼 컴포넌트를 렌더링합니다.

import Login from '@/components/Login';
import AuthLayout from '@/components/AuthLayout'; // [추가] AuthLayout import

export default function LoginPage() {
  return (
    // [수정] 기존 div 구조를 AuthLayout으로 대체합니다.
    <AuthLayout>
      {/* AuthLayout의 카드 내부에 들어갈 콘텐츠 */}
      <h1 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
        로그인
      </h1>
      <Login />
    </AuthLayout>
  );
}