#!/usr/bin/env node
/**
 * Checks every internal link in `src` against the routes the App Router serves.
 *
 * `verify-navigation.mjs` covers the sidebar. This is wider: it reads every
 * `href='/...'`, `href="/..."` and `router.push('/...')` literal in the source
 * tree, so a dead link inside a page, a component or a redirect is caught too.
 *
 * A link to a route that does not exist renders a branded 404 with no console
 * error, so it survives review and reaches production. That is the failure mode
 * this script exists to prevent.
 *
 * Dynamic segments (`[id]`) match any single value. Query strings and hash
 * fragments are stripped. Externals and template literals are ignored: they are
 * not statically checkable and guessing at them would produce false failures.
 *
 * Exits non-zero when any link is dead.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'src', 'app');
const srcDir = path.join(root, 'src');

/** Every route path the App Router can serve. Route groups are transparent. */
function collectRoutes(dir, prefix = '') {
  const routes = new Set();

  // The directory itself may be a route: `src/app/page.tsx` serves `/`. Checking
  // only the children would omit the root and report every link to `/` as dead.
  if (prefix === '' && existsSync(path.join(dir, 'page.tsx'))) {
    routes.add('/');
  }

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;

    const isGroup = entry.startsWith('(') && entry.endsWith(')');
    const segment = isGroup ? '' : entry;
    const next = `${prefix}/${segment}`.replace(/\/+/g, '/');

    if (existsSync(path.join(full, 'page.tsx'))) {
      routes.add(next === '/' ? '/' : next.replace(/\/$/, ''));
    }
    for (const nested of collectRoutes(full, next)) {
      routes.add(nested);
    }
  }
  return routes;
}

/** `/doctor/patients/[id]` matches `/doctor/patients/abc`. */
function matches(route, href) {
  const routeParts = route.split('/').filter(Boolean);
  const hrefParts = href.split(/[?#]/)[0].split('/').filter(Boolean);

  // Compare by segment count. A prefix test would let `/pharmacist` swallow every
  // `/pharmacist/...` link, which is exactly the dead-link case being hunted here.
  if (routeParts.length !== hrefParts.length) return false;

  for (let i = 0; i < hrefParts.length; i++) {
    const part = routeParts[i];
    if (part.startsWith('[') && part.endsWith(']')) continue;
    if (hrefParts[i] !== part) return false;
  }
  return true;
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Single-quoted href, double-quoted href, and router.push / redirect with a literal.
const PATTERNS = [
  /href=\{?['"`]([^'"`$]*)['"`]\}?/g,
  /(?:router\.(?:push|replace)|redirect)\(\s*['"`]([^'"`$]*)['"`]/g,
];

const routes = collectRoutes(appDir);
const routeList = [...routes];
const seen = new Map(); // href -> Set(file:line)

for (const file of sourceFiles(srcDir)) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  for (const pattern of PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const href = match[1];
      // Only same-origin absolute paths. Relative paths are resolved by the router
      // against the current route and are not checkable from here.
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      if (href.startsWith('/api/')) continue;

      const line = source.slice(0, match.index).split('\n').length;
      const where = `${path.relative(root, file)}:${line}`;
      if (!seen.has(href)) seen.set(href, new Set());
      seen.get(href).add(where);
    }
  }
  void lines;
}

const dead = [];
for (const [href, locations] of seen) {
  if (!routeList.some((route) => matches(route, href))) {
    const head = href.split('/').filter(Boolean)[0];
    const suggestions = routeList.filter((route) => route.startsWith(`/${head}`));
    dead.push({ href, locations: [...locations], suggestions });
  }
}

console.log(`routes discovered: ${routes.size}`);
console.log(`internal links checked: ${seen.size}`);

if (dead.length === 0) {
  console.log('\nall internal links resolve to a real route');
  process.exit(0);
}

console.log(`\n${dead.length} internal link(s) point at a route that does not exist:\n`);
for (const { href, locations, suggestions } of dead) {
  console.log(`  ${href}`);
  for (const location of locations.slice(0, 4)) console.log(`      ${location}`);
  if (suggestions.length > 0) {
    console.log('    existing under the same section:');
    for (const suggestion of suggestions) console.log(`      ${suggestion}`);
  } else {
    console.log('    no routes exist for this section at all');
  }
}
process.exit(1);
