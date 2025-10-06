// 파일 위치: apps/frontend/next.config.js

const path = require('path');

/** @type {import('next').NextConfig} */
let nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },

  // --- Sentry 연동을 위한 최소한의 설정만 남깁니다. ---
  // 프로덕션 빌드에서만 소스맵을 생성하도록 설정합니다.
  productionBrowserSourceMaps: true,


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


module.exports = nextConfig;
