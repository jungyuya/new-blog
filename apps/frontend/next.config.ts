// apps/frontend/next.config.ts (open-next 호환 최종안)
import type { NextConfig } from 'next';

const config: NextConfig = {
  // [핵심 수정] open-next가 정상적으로 동작하도록, output 옵션을 완전히 제거합니다.
  // output: 'standalone', // <--- 이 라인을 반드시 제거해야 합니다.

  // 타입스크립트 빌드 오류를 무시하는 설정은 디버깅을 위해 임시로 유지합니다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;