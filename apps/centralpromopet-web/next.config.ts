import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.googleusercontent.com' }] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'Referrer-Policy', value: process.env.NODE_ENV === 'production' ? 'strict-origin-when-cross-origin' : 'no-referrer-when-downgrade' },
    ] }];
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://centralpromopet-api:4000';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};
export default nextConfig;
