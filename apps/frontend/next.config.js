// apps/frontend/next.config.js
// 역할: 빌드 시 assetPrefix / 릴리스 ID 주입을 지원하고, 개발 중 API 프록시(rewrites)를 유지합니다.
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // 빌드 에러 무시 (현재 설정 유지)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 빌드 시 환경변수 NEXT_PUBLIC_ASSET_PREFIX가 있으면 사용합니다.
  // 예:
  //   NEXT_PUBLIC_ASSET_PREFIX="/20250814-abc123"
  // 혹은 절대 URL:
  //   NEXT_PUBLIC_ASSET_PREFIX="https://blog.jungyu.store/20250814-abc123"
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || '',

  // 클라이언트에서 릴리스 ID를 확인할 수 있게 함 (디버깅/버전 표시에 유용)
  env: {
    NEXT_PUBLIC_RELEASE_ID: process.env.NEXT_PUBLIC_RELEASE_ID || '',
  },

};

module.exports = nextConfig;
