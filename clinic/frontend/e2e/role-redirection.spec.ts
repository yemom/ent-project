import { expect, test, type Page } from '@playwright/test';

/**
 * Role-based login, redirection and route guards.
 *
 * <p>Every sign-in here is real. An earlier version of this file mocked
 * `POST /auth/login` to assert routing, and separately shipped live credentials as
 * defaults. Both were wrong: mocked responses prove only that the client honours a
 * payload the server would never send, and a committed password is a committed
 * password however it is labelled.
 *
 * <p>The accounts below are seeded by `backend/e2e-run.ps1` with a throwaway
 * password that belongs to no real person. The Super Admin credentials come from the
 * environment for the reason described in that script.
 */

/** Throwaway password used by every account the API suite creates. */
const SEEDED_PASSWORD = 'E2e@Clinic2026';

/**
 * Seeded accounts and the dashboard each role lands on.
 *
 * <p>The destinations come from ROLE_HOME in the frontend, so these assertions
 * double as a check that every role actually has a home rather than falling back to
 * a default.
 */
const ROLES = [
  { role: 'DOCTOR', email: 'doctor.one@example.com', target: '/doctor' },
  { role: 'NURSE', email: 'nurse.one@example.com', target: '/nurse' },
  { role: 'PHARMACIST', email: 'pharmacist.one@example.com', target: '/pharmacist/dashboard' },
  { role: 'CASHIER', email: 'cashier.one@example.com', target: '/cashier' },
  { role: 'RECEPTIONIST', email: 'reception.one@example.com', target: '/reception' },
  { role: 'LAB_TECHNICIAN', email: 'lab.one@example.com', target: '/laboratory' },
  { role: 'PATIENT', email: 'patient.one@example.com', target: '/patient' },
  // HOSPITAL_ADMIN is routed to /hospital, matching ROLE_HOME. It may reach
  // /reception too, but its own dashboard is the hospital view.
  { role: 'HOSPITAL_ADMIN', email: 'hospital.admin@example.com', target: '/hospital' },
] as const;

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

test.beforeAll(() => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set. They are read from\n' +
        'backend/.env.local (git-ignored). Run backend/e2e-start-and-run.ps1 first,\n' +
        'which starts the seeded backend these tests sign in to.',
    );
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

test.describe('Role-based redirection and route guards', () => {
  test('a Super Admin lands on the admin dashboard', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.waitForURL((url) => url.pathname.startsWith('/admin'), { timeout: 30_000 });
    expect(page.url()).toContain('/admin');
  });

  test('every role lands on its own dashboard', async ({ page }) => {
    for (const account of ROLES) {
      // A step per role, so a failure names the role instead of just timing out
      // somewhere in a seven-iteration loop.
      await test.step(`${account.role} lands on ${account.target}`, async () => {
        await signIn(page, account.email, SEEDED_PASSWORD);
        await page.waitForURL((url) => url.pathname.startsWith(account.target), {
          timeout: 30_000,
        });

        expect(page.url()).toContain(account.target);

        // A clinical or front-desk role must never be shown the admin area on
        // sign-in. HOSPITAL_ADMIN is excluded: it legitimately reaches /hospital,
        // which is a different area from /admin.
        expect(page.url()).not.toContain('/admin/users');

        // Start each iteration from a clean session, or the next sign-in is made
        // against an already-authenticated store.
        await page.context().clearCookies();
        await page.evaluate(() => {
          sessionStorage.clear();
          localStorage.clear();
        });
      });
    }
  });

  test('a doctor is denied the admin area and returned to their dashboard', async ({ page }) => {
    await signIn(page, 'doctor.one@example.com', SEEDED_PASSWORD);
    await page.waitForURL((url) => url.pathname.startsWith('/doctor'), { timeout: 30_000 });

    // Typing the URL directly must not get past the guard.
    await page.goto('/admin/users');
    await page.waitForURL((url) => url.pathname.startsWith('/doctor'), { timeout: 20_000 });
    expect(page.url()).toContain('/doctor');
  });

  test('a cashier is denied the admin area', async ({ page }) => {
    await signIn(page, 'cashier.one@example.com', SEEDED_PASSWORD);
    await page.waitForURL((url) => url.pathname.startsWith('/cashier'), { timeout: 30_000 });

    await page.goto('/admin/users');
    await page.waitForURL((url) => !url.pathname.startsWith('/admin'), { timeout: 20_000 });
    expect(page.url()).not.toContain('/admin/users');
  });

  test('the backend refuses a non-admin even if the guard is bypassed', async ({ page }) => {
    await signIn(page, 'cashier.one@example.com', SEEDED_PASSWORD);
    await page.waitForURL((url) => url.pathname.startsWith('/cashier'), { timeout: 30_000 });

    // The client-side guard is UX. This proves the API is the real boundary by
    // calling it directly with the cashier's own token, bypassing the UI entirely.
    //
    // The base URL is passed in rather than read from `process.env`, which does not
    // exist inside the page.
    const apiBaseUrl =
      process.env.E2E_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8090/api/v1';

    const status = await page.evaluate(async (base: string) => {
      const token = sessionStorage.getItem('clinic.accessToken');
      const response = await fetch(`${base}/admin/users/search`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status;
    }, apiBaseUrl);

    expect(status).toBe(403);
  });

  test('an unauthenticated visitor is sent to the login page', async ({ page }) => {
    for (const path of ['/doctor', '/admin', '/admin/users', '/patient']) {
      await page.goto(path);
      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 20_000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('invalid credentials are refused and establish no session', async ({ page }) => {
    await signIn(page, 'doctor.one@example.com', 'WrongPassword999!');

    // The failure is reported, and no session is created.
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/login');

    // Critically: the rejected attempt must not have restored a previous session.
    const token = await page.evaluate(() => sessionStorage.getItem('clinic.accessToken'));
    expect(token).toBeNull();
  });

  test('signing out clears the session', async ({ page }) => {
    await signIn(page, 'cashier.one@example.com', SEEDED_PASSWORD);
    await page.waitForURL((url) => url.pathname.startsWith('/cashier'), { timeout: 30_000 });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 20_000 });

    await page.goto('/cashier');
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 20_000 });
    expect(page.url()).toContain('/login');
  });
});
