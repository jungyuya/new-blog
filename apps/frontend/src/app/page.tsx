// apps/frontend/src/app/page.tsx (임시 수정본)
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">블로그 프로젝트에 오신 것을 환영합니다!</h1>
      <p className="text-lg mb-4">그라라라라라라! 현재 배포 파이프라인을 구축하고 있습니다.</p>
      <div className="flex gap-4">
        <Link href="/posts/new" className="p-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700">
          새 글 작성 페이지 (임시 링크)
        </Link>
      </div>
    </main>
  );
}
