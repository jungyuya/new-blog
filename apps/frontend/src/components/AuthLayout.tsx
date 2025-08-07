// apps/frontend/src/components/AuthLayout.tsx (임시 수정본)
'use client';

// 모든 Amplify 관련 로직을 제거하고,
// 단순히 자식 컴포넌트를 그대로 렌더링하는 역할만 수행합니다.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}