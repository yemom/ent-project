import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Output directory, overridable per process type.
 *
 * `next dev`, `next build` and the Playwright web server all default to `.next`.
 * When two of them overlap they overwrite each other's files mid-run, and the
 * survivor then fails on missing manifests:
 *
 *   ENOENT: no such file or directory, open '.next/prerender-manifest.json'
 *   ENOENT: no such file or directory, open '.next/server/pages-manifest.json'
 *   Cannot find module for page: /(protected)/admin/page
 *
 * Those read as source bugs and are not: the source is fine, the output directory
 * was being shared. Giving each mode its own directory makes the collision
 * structurally impossible rather than relying on remembering to delete `.next`
 * first.
 *
 * NEXT_DIST_DIR is set by the npm scripts below.
 */
const distDir = process.env.NEXT_DIST_DIR ?? '.next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript is checked by `npm run typecheck` / CI before build. Skipping
    // Next's internal checker prevents it from trying to auto-install packages
    // when the package manager shim is unavailable in constrained Windows shells.
    ignoreBuildErrors: true,
  },
  // Without this Next.js infers the workspace root from the nearest lockfile and
  // warns on every build; it also walks the wrong tree for standalone tracing.
  outputFileTracingRoot: path.resolve(__dirname),
  distDir,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.local',
  ],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
