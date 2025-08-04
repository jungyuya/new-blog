// apps/frontend/next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone', // <--- 이 라인을 삭제합니다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;