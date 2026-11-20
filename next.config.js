/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Built-in replacement for next-transpile-modules (Next >= 13.1).
  transpilePackages: [
    'swagger-ui-react',
    'react-syntax-highlighter',
    'swagger-client',
    '@schafevormfenster/data-text-mapper',
  ],
  // re2 is a native addon (url-regex-safe, also inside the transpiled data-text-mapper).
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium', 're2'],
  outputFileTracingIncludes: {
    '/api/ics': ['./data/**/*'],
  },
};

module.exports = nextConfig;
