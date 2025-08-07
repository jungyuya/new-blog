// apps/frontend/src/app/page.tsx (SignUp 폼 추가)
import SignUp from '@/components/SignUp'; // SignUp 컴포넌트를 import 합니다.

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">블로그 프로젝트</h1>
        <p className="text-lg text-gray-600 mt-2">BFF 패턴을 사용한 커스텀 인증 구현</p>
      </div>
      <SignUp />
    </main>
  );
}