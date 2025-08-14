// apps/frontend/src/app/page.tsx (SignUp 폼추가)
import SignUp from '@/components/SignUp'; // SignUp 컴포넌트를 import 합니다.

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">Deep Dive!🐬</h1>
        <p className="text-lg text-gray-600 mt-2">이제 고속도로 위에서 진정한 개발을 시작해볼까?</p>
      </div>
      <SignUp />
    </main>
  );
}