// 파일 위치: apps/frontend/src/app/signup/page.tsx

import SignUp from '@/components/SignUp';
import AuthLayout from '@/components/AuthLayout'; // [추가] AuthLayout import

export default function SignUpPage() {
  return (
    // [수정] 기존 div 구조를 AuthLayout으로 대체합니다.
    <AuthLayout>
      <h1 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
        회원가입
      </h1>
      <SignUp />
    </AuthLayout>
  );
}