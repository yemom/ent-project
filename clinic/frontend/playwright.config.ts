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
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
