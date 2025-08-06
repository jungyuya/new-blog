// apps/frontend/next.config.js (최종 완결본 - 경로 수정)
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // [핵심 최종 수정] experimental 객체 바깥, 즉 최상위 레벨로 이동합니다.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;