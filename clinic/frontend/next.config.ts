import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.local",
    "192.168.8.*",      
    "192.168.20.*",
    "192.168.137.*"
  ],
};

export default nextConfig;