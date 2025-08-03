// apps/frontend/app/providers.tsx (최종 완성본)
'use client';

import { Amplify } from 'aws-amplify';
// [핵심 수정] '.json' 확장자를 제거하여 TypeScript 모듈을 import 하도록 변경합니다.
import config from '../../src/amplifyconfiguration';
import { useState, useEffect } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    try {
      // 이제 config 변수는 JSON을 파싱한 결과가 아닌,
      // TypeScript 모듈이 직접 export한 객체이므로 훨씬 더 안정적입니다.
      Amplify.configure(config, { ssr: true });
      setIsConfigured(true);
      console.log("✅ Amplify configured successfully from TS module!");
    } catch (error) {
      console.error("❌ Error configuring Amplify:", error);
    }
  }, []);

  if (!isConfigured) {
    return <div>Amplify 설정 중...</div>;
  }

  return <>{children}</>;
}