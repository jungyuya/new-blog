import SignUp from '@/components/SignUp';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-200 via-sky-300 to-blue-400 p-4">
      <div className="w-full max-w-md rounded-xl bg-white/80 backdrop-blur-sm p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-sky-600">
              Deep Dive!🐬
          </h1>
          <p className="mt-4 text-lg text-blue-800">
             🛠️인테리어 & 여름 휴가 중⛵
          </p>
        </div>
        <SignUp />
      </div>
    </main>
  );
}
