/** @type {import('next').NextConfig} */
const withTM = require('next-transpile-modules')([
  'swagger-ui-react',
  'react-syntax-highlighter',
  'swagger-client',
  '@schafevormfenster/data-text-mapper'
]);

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  },
}

module.exports = withTM(nextConfig);