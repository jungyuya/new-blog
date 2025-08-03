// apps/frontend/src/components/AuthLayout.tsx
'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// 이 컴포넌트의 유일한 역할은 자식들을 Authenticator.Provider로 감싸는 것입니다.
// 이를 통해 이 컴포넌트의 모든 자식들은 useAuthenticator 훅을 안전하게 사용할 수 있게 됩니다.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Authenticator.Provider>
      {children}
    </Authenticator.Provider>
  );
}