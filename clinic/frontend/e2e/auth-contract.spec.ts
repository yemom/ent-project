import { expect, test } from '@playwright/test';

/**
 * The login payload contract.
 *
 * <p>Written as a browser test rather than a unit test because the bug it guards
 * against lived at a boundary TypeScript could not see: the server returns
 * `permissions` at the TOP LEVEL of the auth response, the frontend type declared
 * only `{ user }`, and the field was silently dropped. Nothing failed to compile.
 *
 * <p>What made it dangerous was that the store then fell back to a locally
 * mirrored permission matrix, which agreed with the server most of the time. The
 * app looked correct right up until the mirror and the real matrix drifted, and
 * then screens appeared for roles that had no access to them.
 *
 * <p>So the assertion is about what ends up in the session store, which is the only
 * place the loss was observable.
 */

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

test.beforeAll(() => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set. They are read from ' +
        'backend/.env.local; run backend/e2e-start-and-run.ps1 first.',
    );
  }
});

/** Reads the persisted session out of the browser, the same way a reload would. */
async function readStoredSession(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('clinic-auth');
    return raw ? JSON.parse(raw) : null;
  });
}

test.describe('Auth response contract', () => {
  test('login stores the permissions the server actually returned', async ({ page }) => {
    // Read the server's own answer first, so the assertion below compares the
    // stored session against ground truth rather than against a hardcoded list.
    const serverResponse = await page.request.post(
      `${process.env.E2E_API_BASE_URL ?? 'http://localhost:8090/api/v1'}/auth/login`,
      { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }
    );
    expect(serverResponse.ok()).toBe(true);

    const body = await serverResponse.json();
    const serverPermissions: string[] = body.permissions ?? [];

    // Guards the premise of the test: the server really does send them.
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(serverPermissions.length).toBeGreaterThan(0);

    // Now sign in through the actual application.
    await page.goto('/login');
    await page.locator('#login-email').fill(ADMIN_EMAIL!);
    await page.locator('#login-password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });

    const stored = await readStoredSession(page);
    expect(stored).not.toBeNull();
    expect(stored.state.user).toBeDefined();

    // The permissions must have survived the trip through the API layer.
    expect(Array.isArray(stored.state.user.permissions)).toBe(true);
    expect(stored.state.user.permissions).toEqual(serverPermissions);
  });

  test('the permission list survives a full page reload', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill(ADMIN_EMAIL!);
    await page.locator('#login-password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });

    const before = await readStoredSession(page);

    // A hard reload, not a client-side navigation: this is the path where a
    // rehydration bug would drop the session.
    await page.reload();
    await page.waitForLoadState('networkidle');

    const after = await readStoredSession(page);
    expect(after.state.user.role).toBe(before.state.user.role);
    expect(after.state.user.permissions ?? []).toEqual(before.state.user.permissions ?? []);

    // And the user is still authenticated -- the reload must not bounce to /login.
    await expect(page).not.toHaveURL(/\/login/);
  });
});
