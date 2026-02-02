// 파일 위치: apps/frontend/next.config.js

const path = require('path');

/** @type {import('next').NextConfig} */
let nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // typescript: {
  //   ignoreBuildErrors: false,
  // },
  experimental: {
    serverExternalPackages: ['import-in-the-middle', 'require-in-the-middle'],
  },

  // --- [핵심 수정 1/3] Sentry 연동을 위한 최소한의 설정만 남깁니다. ---
  // 프로덕션 빌드에서만 소스맵을 생성하도록 설정합니다.
  productionBrowserSourceMaps: true,
  // --- 수정 끝 ---

  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || '',
  env: {
    NEXT_PUBLIC_RELEASE_ID: process.env.NEXT_PUBLIC_RELEASE_ID || '',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'blog-image-bucket-bloginfrastack.s3.ap-northeast-2.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true,
  });
  nextConfig = withBundleAnalyzer(nextConfig);
}

// --- [핵심 수정 2/3] Sentry 마법사가 추가했던 withSentryConfig 부분을 모두 제거합니다. ---
// const { withSentryConfig } = require("@sentry/nextjs");
// module.exports = withSentryConfig( ... );
// --- 수정 끝 ---

// --- [핵심 수정 3/3] 최종적으로 nextConfig 객체만 export 합니다. ---
module.exports = nextConfig;
