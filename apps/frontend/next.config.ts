// apps/frontend/next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone', // standalone 옵션은 유지합니다. 이것은 Amplify 배포에 중요합니다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;