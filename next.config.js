/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/generate-pdf': ['./node_modules/@sparticuz/chromium/**/*'],
  },
};

module.exports = nextConfig;
