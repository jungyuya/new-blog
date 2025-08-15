// 파일 위치: apps/frontend/src/app/login/page.tsx
// 역할: /login 경로에 해당하는 페이지를 정의하고, 로그인 폼 컴포넌트를 렌더링합니다.

import Login from '@/components/Login'; // '@/'는 src/ 디렉토리를 가리키는 절대 경로입니다.

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          로그인
        </h1>
        <Login />
      </div>
    </div>
  );
}