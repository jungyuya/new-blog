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
  module.exports,
  {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: "deep-dive",
    project: "jungyu-blog-frontend",

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
