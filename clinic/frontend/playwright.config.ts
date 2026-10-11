import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Super Admin account-management suite.
 *
 * <p>`webServer` boots the frontend itself so `npm run e2e` works from a clean
 * checkout. The backend is *not* started here: it needs a Super Admin credential
 * that must come from the environment, and the suite must never invent one. Start
 * the backend separately (see backend/e2e-start-and-run.ps1) or point
 * E2E_BASE_URL at a running instance.
 *
 * <p>Serialised (`workers: 1`) because the tests create, suspend and delete
 * accounts. Running them concurrently would have one test's cleanup removing
 * another's subject.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
void PORT;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Builds and serves the production bundle on its own output directory.
        // See scripts/dev-e2e.mjs for why this is a build rather than `next dev`,
        // and why the output directory is separate.
        command: 'npm run e2e:server',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
