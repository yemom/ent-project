import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    allowedDevOrigins: [
      'localhost:3000',
      '127.0.0.1:3000',
      '192.168.137.1:3000',
    ],
  },
};

export default nextConfig;
