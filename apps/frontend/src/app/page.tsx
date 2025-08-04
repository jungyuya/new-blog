// apps/frontend/src/app/page.tsx (최종 완성본)
'use client';

import { Authenticator, useAuthenticator, Button, Heading } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { fetchPosts, Post } from '../utils/api';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import AuthLayout from '../components/AuthLayout'; // '@/components/'는 'src/components/'를 가리킵니다.

/**
 * 로그인한 사용자에게 보여줄 실제 대시보드 UI 컴포넌트입니다.
 */
function Dashboard() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태 추가

  // 이 컴포넌트가 화면에 처음 나타날 때 게시물 목록을 불러옵니다.
  useEffect(() => {
    async function loadPosts() {
      setIsLoading(true);
      const fetchedPosts = await fetchPosts();
      setPosts(fetchedPosts);
      setIsLoading(false);
    }
    loadPosts();
  }, []); // 빈 의존성 배열 `[]`은 최초 1회만 실행됨을 의미합니다.

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-24">
      <div className="w-full max-w-4xl">
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <Heading level={1} className="text-xl sm:text-2xl md:text-3xl">
            안녕하세요, {user?.signInDetails?.loginId || user?.username}!
          </Heading>
          <div className="flex items-center gap-4">
            <Link href="/posts/new">
              <Button variation="primary">새 글 작성</Button>
            </Link>
            <Button onClick={signOut}>로그아웃</Button>
          </div>
        </header>
        
        <section>
          <h2 className="text-3xl font-bold mb-6 border-b pb-2">게시물 목록</h2>
          {isLoading ? (
            <p>게시물 목록을 불러오는 중...</p>
          ) : posts.length > 0 ? (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.postId} className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  {/* 나중에 상세 페이지를 만들 것을 대비해 Link 컴포넌트를 사용합니다. */}
                  <Link href={`/posts/${post.postId}`} className="block">
                    <h3 className="text-2xl font-semibold text-gray-800 hover:text-blue-600">{post.title}</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      작성자: {post.authorEmail} | 작성일: {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>아직 게시물이 없습니다. 첫 번째 글을 작성해보세요!</p>
          )}
        </section>
      </div>
    </main>
  );
}

/**
 * 앱의 메인 페이지('/') 진입점 역할을 하는 컴포넌트입니다.
 * 인증 상태에 따라 로그인 UI 또는 대시보드를 보여줍니다.
 */
function Home() {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);

  // Amplify가 인증 상태를 확인하는 동안 로딩 화면을 보여줍니다.
  if (authStatus === 'configuring') {
    return <div>로딩 중...</div>;
  }
  
  // 인증이 완료된 사용자에게는 대시보드를 보여줍니다.
  if (authStatus === 'authenticated') {
    return <Dashboard />;
  }

  // 인증되지 않은 사용자에게는 Amplify가 제공하는 기본 로그인/회원가입 UI를 보여줍니다.
  return <Authenticator />;
}

/**
 * 최종적으로 export되는 컴포넌트입니다.
 * 모든 하위 컴포넌트가 useAuthenticator 훅을 안전하게 사용할 수 있도록
 * AuthLayout (내부적으로 Authenticator.Provider)으로 감싸줍니다.
 */
export default function HomePageWithProvider() {
  return (
    <AuthLayout>
      <Home />
    </AuthLayout>
  );
}