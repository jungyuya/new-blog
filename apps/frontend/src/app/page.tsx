import SignUp from '@/components/SignUp';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <main className={`relative flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-200 via-sky-300 to-blue-400 p-4 overflow-hidden ${inter.className}`}>
      
      {/* 마우스를 따라 움직이는 그라데이션 효과 (애니메이션) */}
      <div className="absolute top-0 left-0 w-full h-full animate-gradient-move"></div>

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white/80 backdrop-blur-sm p-8 shadow-2xl transition-all duration-300 hover:shadow-sky-500/50">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold text-sky-600 drop-shadow-lg transition-colors duration-500 hover:text-blue-500">
            Deep Dive!🐬
          </h1>
          <p className="mt-4 text-lg font-medium text-blue-900 transition-transform duration-300 hover:rotate-1">
            🛠️인테리어 중 && 여름 휴가 중!⛵
          </p>
        </div>
        <SignUp />
        
      </div>
    </main>
  );
}