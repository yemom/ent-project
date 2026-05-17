import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins: [
    "*.local",
    "192.168.20.*",   // allows any device on your local network
  ],
  // speeds up dev compilation significantly
  experimental: {
    turbo: {},
  },
};

export default nextConfig;
