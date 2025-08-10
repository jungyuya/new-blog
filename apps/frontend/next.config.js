// 파일 위치: apps/frontend/next.config.js
// 변경 사항: 개발 환경에서 API 요청을 프록시하기 위한 'rewrites' 설정 추가
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },
  // [추가] 개발 환경에서만 적용될 rewrites 설정
  async rewrites() {
    // 이 설정은 'next dev' 실행 시에만 활성화됩니다.
    return [
      {
        source: '/api/:path*', // '/api/'로 시작하는 모든 경로의 요청을
        destination: 'http://localhost:4000/api/:path*', // 백엔드 서버로 전달합니다.
      },
    ];
  },
};

module.exports = nextConfig;