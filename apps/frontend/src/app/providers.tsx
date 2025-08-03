// apps/frontend/app/providers.tsx
'use client'; // 이 파일이 클라이언트 컴포넌트임을 명시하는 것이 매우 중요합니다.

import { Amplify } from 'aws-amplify';
// 우리가 src/ 디렉토리에 만든 설정 파일을 import 합니다.
import config from '../amplifyconfiguration.json';

// Next.js 환경에서 Amplify를 사용할 때, 서버와 클라이언트 간의 상태를 동기화하기 위해 ssr: true 옵션을 설정합니다.
Amplify.configure(config, { ssr: true });

export default function Providers({ children }: { children: React.ReactNode }) {
  // 이 컴포넌트는 UI를 렌더링하지 않고, 오직 Amplify 설정을
  // 앱의 클라이언트 측 진입점에서 단 한 번 실행하는 중요한 역할을 합니다.
  return <>{children}</>;
}