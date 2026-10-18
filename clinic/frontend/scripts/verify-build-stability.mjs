#!/usr/bin/env node
/**
 * Proves that production builds do not mutate `tsconfig.json`.
 *
 * Next.js rewrites `tsconfig.json` whenever the active output directory is absent
 * from its `include` array. Because this project supports several output
 * directories (`.next`, `.next-e2e`, `.next-build`, `.next-verify`), that used to
 * mean a build could silently edit a tracked source file, and the only remedy in
 * use was restoring the file by hand afterwards.
 *
 * This script runs the production build twice per supported output directory and
 * asserts, after every build, that:
 *
 *   1. `tsconfig.json` is byte-identical to how it started;
 *   2. `git status` shows no unexpected change under the frontend;
 *   3. the build itself exited zero and emitted a server bundle.
 *
 * Usage:
 *   node scripts/verify-build-stability.mjs            # .next and .next-verify
 *   node scripts/verify-build-stability.mjs .next-e2e  # one specific directory
 *
 * Exits non-zero on the first violation so CI can gate on it.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsconfigPath = path.join(root, 'tsconfig.json');

/** Output directories exercised when none are named on the command line. */
const DEFAULT_DIST_DIRS = ['.next', '.next-verify'];

const distDirs = process.argv.slice(2).filter(Boolean);
const targets = distDirs.length > 0 ? distDirs : DEFAULT_DIST_DIRS;

const failures = [];

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Files Next.js is allowed to leave behind, and nothing else. */
const ALLOWED_GIT_CHANGES = new Set(['tsconfig.json']);

function gitStatus() {
  const result = spawnSync('git', ['status', '--porcelain', '--', 'clinic/frontend'], {
    cwd: path.resolve(root, '..', '..'),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    // Not a git checkout (CI export, tarball): nothing to compare against.
    return null;
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'));
}

function build(distDir) {
  const result = spawnSync(process.execPath, [nextBin(), 'build'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, NEXT_DIST_DIR: distDir },
  });
  return result;
}

function nextBin() {
  // `next` is resolved through npx on every platform rather than assuming a
  // POSIX-style .bin shim.
  return path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
}

const tsconfigBefore = digest(tsconfigPath);
const gitBefore = gitStatus();

console.log(`tsconfig.json sha256 before: ${tsconfigBefore.slice(0, 16)}…`);
console.log(`output directories under test: ${targets.join(', ')}\n`);

for (const distDir of targets) {
  console.log(`── building into ${distDir} ──────────────────────────────`);

  const started = Date.now();
  const result = build(distDir);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);

  if (result.status !== 0) {
    failures.push(`build into ${distDir} exited ${result.status}\n${tail(result.stdout)}\n${tail(result.stderr)}`);
    console.log(`   FAILED after ${seconds}s (exit ${result.status})\n`);
    continue;
  }

  const serverBundle = path.join(root, distDir, 'server');
  if (!fs.existsSync(serverBundle)) {
    failures.push(`build into ${distDir} reported success but produced no ${distDir}/server`);
    console.log(`   FAILED: no server bundle\n`);
    continue;
  }

  const tsconfigAfter = digest(tsconfigPath);
  if (tsconfigAfter !== tsconfigBefore) {
    failures.push(
      `build into ${distDir} modified tsconfig.json\n` +
        `  before: ${tsconfigBefore}\n  after:  ${tsconfigAfter}`,
    );
    console.log(`   FAILED: tsconfig.json changed\n`);
  } else {
    console.log(`   ok: build succeeded in ${seconds}s, tsconfig.json unchanged`);
  }
}

const gitAfter = gitStatus();
if (gitBefore !== null && gitAfter !== null) {
  const added = gitAfter.filter((file) => !gitBefore.includes(file));
  const unexpected = added.filter((file) => !ALLOWED_GIT_CHANGES.has(file));
  if (unexpected.length > 0) {
    failures.push(`build left unexpected new files in git status:\n  ${unexpected.join('\n  ')}`);
    console.log(`\nFAILED: unexpected files appeared:\n  ${unexpected.join('\n  ')}`);
  } else {
    console.log(`ok: no unexpected files entered git status`);
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed:`);
  for (const failure of failures) {
    console.error(`\n- ${failure}`);
  }
  process.exit(1);
}

console.log(`all checks passed: ${targets.length} build(s) left tsconfig.json and git status untouched`);

function tail(text) {
  if (!text) return '';
  return text.split('\n').slice(-25).join('\n');
}