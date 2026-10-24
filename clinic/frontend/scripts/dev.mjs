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
 * Deleting it costs one rebuild and removes that whole class of failure, so it is
 * done on every start rather than left to the developer to diagnose.
 *
 * <p><b>But the clean-up is destructive to a server that is already running.</b>
 * Starting a second `npm run dev` deletes the directory out from under the first
 * one, which then fails in ways that point nowhere near the cause — on Windows an
 * endless stream of
 *
 *   [Error: UNKNOWN: unknown error, open '.next-dev/react-loadable-manifest.json']
 *
 * naming a file the developer never touched. Checking whether the delete *fails* is
 * not enough: Windows lets a running server's files be deleted, so the delete
 * succeeds and the damage is silent. Hence the PID sentinel below, which is checked
 * before the clean-up rather than inferred from it.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Keep development output separate from `next start`/`next build` output. A
// production server may still be serving `.next` on port 3000; clearing that
// directory while starting dev corrupts the server's React Client Manifest.
const DIST_DIR = process.env.NEXT_DIST_DIR ?? '.next-dev';
const root = process.cwd();

/**
 * Marks this project as having a running dev server, and by which process.
 *
 * <p>Held in the OS temp directory rather than inside the output directory,
 * because `next dev` rewrites its own dist dir on startup and deletes files it does
 * not own — a claim placed there is silently removed before it can be read. Keyed by
 * a hash of the project path so two checkouts do not collide, and so nothing is
 * added to the repository (which would need ignoring and would show up in diffs).
 *
 * <p>If the temp directory is cleared the claim is lost and a second server may
 * start; that fails towards the old behaviour rather than blocking a legitimate run.
 */
const SENTINEL = join(
  tmpdir(),
  `clinic-dev-${createHash('sha256').update(resolve(root)).digest('hex').slice(0, 16)}.pid`,
);

/** Whether a process id is still running. Signal 0 performs the permission and
 *  existence checks without delivering anything. */
function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return error.code === 'EPERM';
  }
}

/**
 * Refuses to start when a live dev server already owns the output directory.
 *
 * @returns the owning process id, or {@code null} when the directory is free
 */
function findRunningServer() {
  if (!existsSync(SENTINEL)) return null;
  const owner = Number.parseInt(readFileSync(SENTINEL, 'utf8').trim(), 10);
  if (!Number.isInteger(owner) || owner <= 0) return null; // unreadable/garbage: treat as free
  return isRunning(owner) ? owner : null;
}

const runningServer = findRunningServer();
if (runningServer) {
  process.stderr.write(
    `\nA dev server is already running against ${DIST_DIR} (pid ${runningServer}).\n\n` +
      `Starting a second one would delete ${DIST_DIR} out from under it, and the first\n` +
      `server then fails with UNKNOWN/open errors on its own build manifests.\n\n` +
      `  Stop it first:  Stop-Process -Id ${runningServer}\n` +
      `  Or run 'npm run dev:fast' to start a second one deliberately — it skips both\n` +
      `  the sentinel check and the clean-up, and Next.js moves to the next free port.\n\n`,
  );
  process.exit(1);
}

if (process.env.NEXT_SKIP_DIST_CLEAN !== 'true') {
  // No `force`, so a genuinely locked directory is reported here instead of leaving
  // `next dev` to start against a half-removed tree. ENOENT is not that case — a
  // missing output directory is the normal state on a first run, and `force` is
  // only omitted so that a real failure is not swallowed.
  try {
    rmSync(join(root, DIST_DIR), { recursive: true, force: false });
    process.stdout.write(`Cleared ${DIST_DIR} before starting the dev server.\n`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      process.stderr.write(
        `\nCannot clear ${DIST_DIR}: ${error.code ?? error.message}\n\n` +
          `Something is holding the directory. Close any editor or tool with it open,\n` +
          `then run this again; or use 'npm run dev:fast' to start without the clean-up.\n\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`No previous ${DIST_DIR} to clear.\n`);
  }
}

// Claim the project before spawning, so a concurrent second start sees the sentinel
// rather than racing through the clean-up.
writeFileSync(SENTINEL, String(process.pid), 'utf8');

const child = spawn(
  process.platform === 'win32' ? 'next.cmd' : 'next',
  ['dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NEXT_DIST_DIR: DIST_DIR },
  }
);

/** Releases the claim. Best-effort: the next start tolerates a stale sentinel. */
function release() {
  try {
    if (existsSync(SENTINEL) && readFileSync(SENTINEL, 'utf8').trim() === String(process.pid)) {
      unlinkSync(SENTINEL);
    }
  } catch {
    /* the directory may already be gone; nothing to release */
  }
}

const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', release);

child.on('exit', (code, signal) => {
  release();
  process.exit(signal ? 1 : (code ?? 0));
});
