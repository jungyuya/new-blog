// apps/frontend/next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
let nextConfig = { // [수정] const 대신 let으로 변경하여 재할당이 가능하게 합니다.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },
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

// [추가] ANALYZE 환경 변수가 true일 때만 번들 분석기를 활성화합니다.
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true, // ANALYZE=true일 때 항상 활성화되도록 명시
  });
  nextConfig = withBundleAnalyzer(nextConfig);
}

module.exports = nextConfig;