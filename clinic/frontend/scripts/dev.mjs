/**
 * Dev server entry point.
 *
 * <p>Adds one thing to `next dev`: it clears a stale output directory first.
 *
 * <p>Without this, an interrupted build or a dev server killed mid-compile leaves
 * `.next` half-written, and the next start fails in a way that looks like a source
 * bug:
 *
 *   ENOENT: no such file or directory, open '.next/prerender-manifest.json'
 *   ENOENT: no such file or directory, open '.next/server/pages-manifest.json'
 *   Cannot find module for page: /(protected)/admin/page
 *   GET /admin 500
 *
 * Those are Next.js reading a directory another process was writing to. Deleting
 * it costs one rebuild and removes the entire class of failure, so it is done on
 * every start rather than left to the developer to diagnose.
 *
 * <p>`npm run dev:fast` skips the clean-up when a second dev server is deliberately
 * running against the same directory.
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

// Keep development output separate from `next start`/`next build` output. A
// production server may still be serving `.next` on port 3000; clearing that
// directory while starting dev corrupts the server's React Client Manifest.
const DIST_DIR = process.env.NEXT_DIST_DIR ?? '.next-dev';
const root = process.cwd();

if (process.env.NEXT_SKIP_DIST_CLEAN !== 'true') {
  rmSync(join(root, DIST_DIR), { recursive: true, force: true });
  process.stdout.write(`Cleared ${DIST_DIR} before starting the dev server.\n`);
}

const child = spawn(
  process.platform === 'win32' ? 'next.cmd' : 'next',
  ['dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NEXT_DIST_DIR: DIST_DIR },
  }
);

const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
