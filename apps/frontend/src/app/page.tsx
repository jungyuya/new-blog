// apps/frontend/src/app/page.tsx

'use client';

import { Authenticator, useAuthenticator, Button, Heading } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// 1. 로그인 되었을 때 보여줄 컴포넌트
function AuthenticatedApp() {
  // useAuthenticator 훅을 사용하여 로그인 정보와 로그아웃 함수를 가져옵니다.
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  return (
    <main>
      <Heading level={1}>안녕하세요, {user?.signInDetails?.loginId || user?.username} 행님!</Heading>
      <p>성공적으로 로그인 완료!!</p>
      <p>이제 보호된 컨텐츠를 만나보세요.</p>
      
      {/* 로그아웃 버튼 */}
      <Button onClick={signOut} variation="primary">로그아웃</Button>
    </main>
  );
}

// 2. 메인 페이지 컴포넌트
export default function Home() {
  return (
    // Authenticator로 전체 앱을 감쌉니다.
    // 로그인하지 않은 사용자는 내장된 로그인 UI를 보게 되고,
    // 로그인한 사용자는 자식 컴포넌트인 <AuthenticatedApp />을 보게 됩니다.
    <Authenticator>
      <AuthenticatedApp />
    </Authenticator>
  );
}