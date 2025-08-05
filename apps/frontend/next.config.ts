// apps/frontend/next.config.ts (Standalone 모드 최종안)
import type { NextConfig } from 'next';

const config: NextConfig = {
  // [핵심 최종 수정] Standalone 모드를 활성화하여,
  // 모든 의존성이 물리적으로 포함된 배포 패키지를 생성합니다.
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;