// apps/frontend/next.config.js (최종 완결본)
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;