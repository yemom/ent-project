#!/usr/bin/env node
/**
 * Checks that every sidebar/navigation target in `src/config/navigation.ts`
 * corresponds to a real route under `src/app`.
 *
 * The failure this catches is mundane and expensive: a nav entry pointing at a
 * route that was renamed or never existed renders a branded 404 with no console
 * error, so it survives review and reaches production. `/pharmacist/prescriptions`
 * was one such link — the page had always lived at `/pharmacist/orders`.
 *
 * Dynamic segments (`[id]`) are matched as a wildcard so `/doctor/patients/abc`
 * validates against `/doctor/patients/[id]`.
 *
 * Exits non-zero when any link is dead.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'src', 'app');
const navFile = path.join(root, 'src', 'config', 'navigation.ts');

/** Collects every route path the App Router can serve. */
function collectRoutes(dir, prefix = '') {
  const routes = new Set();
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;

    // Route groups like `(protected)` and `(auth)` organise files without
    // affecting the URL, so they are transparent here.
    const isGroup = entry.startsWith('(') && entry.endsWith(')');
    const segment = isGroup ? '' : entry;
    const next = `${prefix}/${segment}`.replace(/\/+/g, '/');

    if (readdirSync(full).includes('page.tsx')) {
      routes.add(next === '/' ? '/' : next.replace(/\/$/, ''));
    }
    for (const nested of collectRoutes(full, next)) {
      routes.add(nested);
    }
  }
  return routes;
}

/** Turns `/doctor/patients/[id]` into a matcher for one concrete path. */
function matches(route, href) {
  const routeParts = route.split('/').filter(Boolean);
  const hrefParts = href.split('?')[0].split('/').filter(Boolean);

  // Exact by segment count. A prefix test would let the `/pharmacist` index page
  // swallow every `/pharmacist/...` link, which is precisely the dead-link case
  // this script exists to find — so the comparison has to walk the *link*, not
  // the route.
  if (routeParts.length !== hrefParts.length) return false;

  for (let i = 0; i < hrefParts.length; i++) {
    const part = routeParts[i];
    if (part.startsWith('[') && part.endsWith(']')) continue; // dynamic segment
    if (hrefParts[i] !== part) return false;
  }
  return true;
}

const routes = collectRoutes(appDir);
const source = readFileSync(navFile, 'utf8');

const hrefs = [...source.matchAll(/href:\s*'([^']+)'/g)]
  .map((m) => m[1])
  .filter((href) => href.startsWith('/'));

const dead = [];
for (const href of new Set(hrefs)) {
  if (![...routes].some((route) => matches(route, href))) {
    // Nearest candidates make the fix obvious rather than guessable.
    const head = href.split('/').filter(Boolean)[0];
    const suggestions = [...routes].filter((route) => route.startsWith(`/${head}`));
    dead.push({ href, suggestions });
  }
}

console.log(`routes discovered: ${routes.size}`);
console.log(`navigation links checked: ${new Set(hrefs).size}`);

if (dead.length === 0) {
  console.log('\nall navigation links resolve to a real route');
  process.exit(0);
}

console.log(`\n${dead.length} navigation link(s) point at a route that does not exist:\n`);
for (const { href, suggestions } of dead) {
  console.log(`  ${href}`);
  if (suggestions.length > 0) {
    console.log(`    existing under the same section:`);
    for (const suggestion of suggestions) console.log(`      ${suggestion}`);
  } else {
    console.log(`    no routes exist for this section at all`);
  }
}
process.exit(1);