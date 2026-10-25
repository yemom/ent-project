import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Output directory, overridable per process type.
 *
 * `next build` and the standalone production server use `.next`; `next dev` uses `.next-dev`.
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

/**
 * Every output directory this project is allowed to build into.
 *
 * `next build` (and `next dev`) run `writeConfigurationDefaults`, which appends the
 * active output directory's generated-types glob to `include` in `tsconfig.json`
 * whenever that exact string is absent. It compares the resolved include list
 * literally, so a project that supports more than one output directory gets its
 * tsconfig rewritten on every build that uses a directory not already listed. The
 * symptom is a `tsconfig.json` that grows a new include entry per distinct
 * `NEXT_DIST_DIR` and then gets "restored" by hand, which is a fragile workaround
 * rather than a fix.
 *
 * So the set of output directories is declared once, here, and enforced in two
 * directions:
 *
 *  - `assertDistDirIsListed` fails the build if the active `distDir` is not in
 *    `tsconfig.json`'s `include`, which is the exact condition that triggers the
 *    rewrite. Failing loudly beats mutating a tracked source file.
 *  - `SUPPORTED_DIST_DIRS` is the single list that `tsconfig.json` mirrors, so a
 *    new output directory has to be added in both places on purpose.
 *
 * `.next` is used by `next build` / the standalone production server; `.next-dev` is used by
 * `next dev`; `.next-e2e` is set by
 * `scripts/dev-e2e.mjs`; `.next-build` and `.next-verify` are the isolated
 * directories used when verifying a production build alongside a running dev
 * server, so a verification build cannot clobber a developer's `.next`.
 */
const SUPPORTED_DIST_DIRS = ['.next', '.next-dev', '.next-e2e', '.next-build', '.next-verify'];

/**
 * The include entry Next.js looks for, built the same way it builds its own.
 */
function nextAppTypes(distDir) {
  return `${distDir}/types/**/*.ts`;
}

/**
 * Fail the build rather than let Next edit `tsconfig.json`.
 *
 * @param {string} distDir the directory this process will build into
 * @param {string} tsconfigPath absolute path to tsconfig.json
 */
function assertDistDirIsListed(distDir, tsconfigPath) {
  const expected = nextAppTypes(distDir);

  if (!SUPPORTED_DIST_DIRS.includes(distDir)) {
    throw new Error(
      `NEXT_DIST_DIR="${distDir}" is not a supported output directory.\n` +
        `Supported: ${SUPPORTED_DIST_DIRS.join(', ')}\n` +
        `Using an unlisted directory makes \`next build\` rewrite tsconfig.json.\n` +
        'Either pick a supported directory or add the new one to ' +
        'SUPPORTED_DIST_DIRS in next.config.mjs and to the `include` array in tsconfig.json.',
    );
  }

  let include;
  try {
    // Next.js writes tsconfig.json through comment-json, which emits strict JSON.
    include = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8')).include;
  } catch (error) {
    throw new Error(
      `Could not read ${tsconfigPath}: ${error.message}\n` +
        'Cannot verify that the build will leave tsconfig.json untouched.',
    );
  }

  if (!Array.isArray(include) || !include.includes(expected)) {
    throw new Error(
      `tsconfig.json is missing "${expected}" in its "include" array.\n` +
        'Next.js rewrites tsconfig.json whenever the active output directory is ' +
        'not listed there, so the build is stopped rather than allowed to edit a ' +
        'tracked file.\n' +
        `Add "${expected}" to the "include" array in ${tsconfigPath}.`,
    );
  }
}

assertDistDirIsListed(distDir, path.join(__dirname, 'tsconfig.json'));

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
  // The Windows build was failing with EPERM while parallel Next workers
  // created route trace directories. A single build CPU avoids concurrent
  // directory creation races in the constrained development environment.
  experimental: {
    cpus: 1,
    parallelServerBuildTraces: false,
  },
  // Without this Next.js infers the workspace root from the nearest lockfile and
  // warns on every build; it also walks the wrong tree for standalone tracing.
  outputFileTracingRoot: path.resolve(__dirname),
  distDir,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.200.13.137',
    '192.168.137.1',
    '192.168.20.27',
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
