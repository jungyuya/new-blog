// 파일 위치: apps/frontend/next.config.js
const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },

  // [추가] 빌드 ID 고정: .build-id 파일이 있으면 그 값을 사용하고,
  // 파일이 없으면 'static-build-id'를 사용합니다.
  // .build-id 를 수동으로 관리(커밋)하면 '의도하지 않은' 빌드 ID 변경을 막을 수 있습니다.
  generateBuildId: async () => {
    try {
      const buildIdPath = path.join(__dirname, '../../.build-id');
      if (fs.existsSync(buildIdPath)) {
        const id = fs.readFileSync(buildIdPath, 'utf8').trim();
        if (id) return id;
      }
      // 안전한 fallback (원하시면 다른 기본값으로 변경 가능)
      return 'static-build-id';
    } catch (err) {
      // 예외가 나더라도 빌드가 실패하지 않도록 안전하게 처리
      return 'static-build-id';
    }
  },

  // [수정] rewrites는 개발 환경(dev)에서만 적용되도록 분기
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*', // '/api/'로 시작하는 모든 경로의 요청을
          destination: 'http://localhost:4000/api/:path*', // 백엔드 서버로 전달합니다.
        },
      ];
    }
    // production (or other envs)에서는 rewrites 없음
    return [];
  },
};

module.exports = nextConfig;
