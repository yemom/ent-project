/**
 * Builds and serves the application for the Playwright suite.
 *
 * <p>Two decisions here, both forced by repeated failures:
 *
 * 1. It runs a real production build rather than `next dev`.
 *    `next dev` compiles a route the first time it is requested, which can take
 *    tens of seconds for a route group as large as `(protected)`. That compile
 *    lands inside whichever test happened to request the route first, so tests
 *    failed on timeouts with no relation to the code under test -- a full run took
 *    15 minutes and still produced four failures. A production build has no lazy
 *    compilation, and it also tests the artifact that actually ships rather than
 *    a development approximation of it.
 *
 * 2. It uses its own output directory.
 *    `next build`, `next dev` and this server all default to `.next`. Two of them
 *    overlapping means one deletes the other's manifests mid-run, which surfaces
 *    as ENOENT on `prerender-manifest.json` and "Cannot find module for page" --
 *    failures that look like source bugs and are not. `NEXT_DIST_DIR` gives this
 *    process `.next-e2e`, so it can never collide with the developer's own
 *    `npm run dev` or `npm run build`.
 *
 * <p>The API base URL is injected rather than read from `.env.local`. The test
 * backend uses a throwaway in-memory database that is wiped and re-seeded on every
 * start; sharing the developer's `.env.local` would mean pointing it at the test
 * port, and then the developer's normal app would silently start talking to a
 * database that disappears under it.
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = '.next-e2e';
const PORT = process.env.E2E_PORT ?? '3100';
const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:8090/api/v1';
const root = process.cwd();

const env = {
  ...process.env,
  NEXT_DIST_DIR: DIST_DIR,
  NEXT_PUBLIC_API_BASE_URL: API,
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
};

const isWindows = process.platform === 'win32';
const nextBin = isWindows ? 'next.cmd' : 'next';

/** Runs a command to completion, rejecting with its exit code on failure. */
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(nextBin, args, {
      stdio: 'inherit',
      shell: isWindows,
      env,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`next ${args.join(' ')} exited ${code}`))
    );
  });
}

await rmSync(join(root, DIST_DIR), { recursive: true, force: true });
await run(['build']);
await run(['start', '--port', PORT]);

// `next start` does not exit on its own; reaching here means something went wrong.
process.exit(1);
