// 파일 위치: apps/frontend/src/app/signup/page.tsx

import SignUp from '@/components/SignUp';

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          회원가입
        </h1>
        <SignUp />
      </div>
    </div>
  );
}