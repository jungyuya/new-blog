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

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  // 첫 번째 인자는 우리가 위에서 정의한 nextConfig 객체입니다.
  // module.exports를 그대로 사용하는 것이 안전합니다.
  module.exports,
  
  // 두 번째 인자는 Sentry Webpack Plugin 옵션입니다.
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: "deep-dive",
    project: "jungyu-blog-frontend",
    
    // --- [핵심 수정] 빌드 시 Sentry의 자동 소스맵 업로드를 비활성화합니다. ---
    // 이 옵션을 true로 설정하면, `next build`는 더 이상 소스맵을 업로드하지 않습니다.
    // 제어권은 전적으로 우리의 CI/CD 워크플로우로 넘어갑니다.
    disable: true,
    // --- 수정 끝 ---

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,
  },

  // 세 번째 인자는 Sentry Next.js SDK 옵션입니다.
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    automaticVercelMonitors: true,
  }
);