/**
 * Super Admin account management, end to end through the browser.
 *
 * <p>Credentials come from the environment, never from this file. A checked-in
 * password for a Super Admin would be a checked-in password for the deployment.
 *
 * <p>The backend must already be running — see backend/e2e-start-and-run.ps1. These
 * tests deliberately do not seed through the API first: the point is to prove the
 * screens themselves create the accounts.
 */

import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

/** Unique per run so a re-run never collides with the previous run's accounts. */
const RUN = Math.random().toString(36).slice(2, 8);

/**
 * Password for the account the deactivation test suspends.
 *
 * <p>Throwaway by design: it exists only for this run, belongs to no real person,
 * and satisfies the password policy. A fixed value is required because the test has
 * to attempt a sign-in afterwards to prove the suspension is real.
 */
const SUSPENDED_PASSWORD = 'E2e@Suspended2026';

test.beforeAll(() => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to run the E2E suite.\n' +
        'They are read from backend/.env.local, which is git-ignored. ' +
        'Start the backend with backend/e2e-start-and-run.ps1, which loads it.',
    );
  }
});

/**
 * Signs in and waits for the app shell.
 *
 * <p>Targets the input by id rather than by label text: the login form's labels are
 * localised ("Email Address" vs "Medical ID or Email"), so a label-based locator is
 * coupled to copy that changes for unrelated reasons.
 */
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}

/**
 * Attempts a sign-in that is expected to fail, and confirms we are still on /login.
 *
 * <p>A separate helper because {@link signIn} waits for a navigation away from the
 * login page — which never happens when the credentials are correctly refused. Used to
 * prove a suspended or deleted account genuinely cannot get in.
 */
async function expectSignInRejected(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // An error message appears and the URL does not change.
  await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

async function openCreateDialog(page: Page, roleLabel: string) {
  await page.goto('/admin/users');
  await page.getByRole('button', { name: /create account/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Role').selectOption({ label: roleLabel });
  return dialog;
}

/**
 * Asserts an account is present in the directory, searching for it first.
 *
 * <p>The table paginates at 20 rows, and this database already holds accounts from the
 * API suite and earlier runs. Scrolling or paging to find a newly created account
 * would test the pagination controls rather than the creation, so the search box is
 * used instead — which is also how an administrator would actually find it.
 */
async function expectAccountVisible(page: Page, email: string) {
  const search = page.getByPlaceholder(/search name, email or phone/i);
  await search.fill(email);
  await expect(
    page.getByRole('row').filter({ hasText: email })
  ).toBeVisible({ timeout: 20_000 });
}

test.describe('Super Admin account management', () => {
  test('creates a doctor, nurse, pharmacist, cashier and patient', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    // Each entry carries every field its role requires, because the form refuses to
    // submit without them — that refusal is itself covered by its own test below.
    const accounts = [
      {
        role: 'Doctor',
        name: `Doctor ${RUN}`,
        email: `doctor.${RUN}@example.com`,
        extra: { Specialization: 'Cardiology', 'License number': `LIC-${RUN}` },
      },
      { role: 'Nurse', name: `Nurse ${RUN}`, email: `nurse.${RUN}@example.com`, extra: {} },
      {
        role: 'Pharmacist',
        name: `Pharmacist ${RUN}`,
        email: `pharmacist.${RUN}@example.com`,
        extra: { 'Employee number': `EMP-${RUN}` },
      },
      { role: 'Cashier', name: `Cashier ${RUN}`, email: `cashier.${RUN}@example.com`, extra: {} },
      {
        role: 'Patient',
        name: `Patient ${RUN}`,
        email: `patient.${RUN}@example.com`,
        extra: { 'Date of birth': '1990-05-20' },
      },
    ] as const;

    for (const account of accounts) {
      const dialog = await openCreateDialog(page, account.role);

      await dialog.getByLabel('Full name').fill(account.name);
      await dialog.getByLabel('Email').fill(account.email);
      // Password left blank on purpose: the server generates one and shows it once,
      // which is the behaviour the temporary-password requirement depends on.
      for (const [label, value] of Object.entries(account.extra)) {
        await dialog.getByLabel(label, { exact: true }).fill(value);
      }

      await dialog.getByRole('button', { name: /create account/i }).click();

      await expect(dialog).toBeHidden({ timeout: 20_000 });

      await page.goto('/admin/users');
      await expectAccountVisible(page, account.email);
    }
  });

  test('a duplicate email is reported on the email field', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    const email = `duplicate.${RUN}@example.com`;

    const first = await openCreateDialog(page, 'Cashier');
    await first.getByLabel('Full name').fill('First Entry');
    await first.getByLabel('Email').fill(email);
    await first.getByRole('button', { name: /create account/i }).click();
    await expect(first).toBeHidden({ timeout: 20_000 });

    const second = await openCreateDialog(page, 'Cashier');
    await second.getByLabel('Full name').fill('Second Entry');
    await second.getByLabel('Email').fill(email);
    await second.getByRole('button', { name: /create account/i }).click();

    // The 409 has to land on the input that caused it, not as a generic banner.
    await expect(second.getByText(/already exists/i)).toBeVisible({ timeout: 20_000 });
    await second.getByRole('button', { name: /cancel/i }).click();
  });

  test('role-specific fields are required and enforced', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    const dialog = await openCreateDialog(page, 'Doctor');
    await dialog.getByLabel('Full name').fill(`No License ${RUN}`);
    await dialog.getByLabel('Email').fill(`nolicense.${RUN}@example.com`);

    await dialog.getByRole('button', { name: /create account/i }).click();

    // A doctor with no license number is not creatable, and the form says so
    // before a request is made.
    await expect(dialog.getByText(/license number is required/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /create account/i })).toBeEnabled();

    await dialog.getByRole('button', { name: /cancel/i }).click();
  });

  test('edits an account', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/users');

    await page.getByPlaceholder(/search name, email or phone/i).fill(`edit.${RUN}@example.com`);
    await page.getByRole('button', { name: /create account/i }).click();

    const create = page.getByRole('dialog');
    await create.getByLabel('Role').selectOption({ label: 'Nurse' });
    await create.getByLabel('Full name').fill(`Before ${RUN}`);
    await create.getByLabel('Email').fill(`edit.${RUN}@example.com`);
    await create.getByRole('button', { name: /create account/i }).click();
    await expect(create).toBeHidden({ timeout: 20_000 });

    await page.getByPlaceholder(/search name, email or phone/i).fill(`edit.${RUN}@example.com`);

    const row = page.getByRole('row').filter({ hasText: `edit.${RUN}@example.com` });
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByRole('button', { name: /edit/i }).click();

    const edit = page.getByRole('dialog');
    await edit.getByLabel('Full name').fill(`After ${RUN}`);
    await edit.getByRole('button', { name: /save changes/i }).click();
    await expect(edit).toBeHidden({ timeout: 20_000 });

    // Scoped to the table: the same text also appears in the toast that confirms
    // the save, and an unscoped locator would match both and be ambiguous.
    await expect(
      page.getByRole('row').filter({ hasText: `After ${RUN}` })
    ).toBeVisible({ timeout: 20_000 });
  });

  test('deactivating requires a reason and takes effect immediately', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/users');

    const email = `suspend.${RUN}@example.com`;

    await page.getByRole('button', { name: /create account/i }).click();
    const create = page.getByRole('dialog');
    await create.getByLabel('Role').selectOption({ label: 'Cashier' });
    await create.getByLabel('Full name').fill(`Suspend ${RUN}`);
    await create.getByLabel('Email').fill(email);
    // A known password, so the test can attempt a sign-in afterwards. Leaving this
    // blank would get a generated credential that is only ever shown once, which
    // this test cannot read back out of the UI.
    await create.getByLabel('Temporary password').fill(SUSPENDED_PASSWORD);
    await create.getByRole('button', { name: /create account/i }).click();
    await expect(create).toBeHidden({ timeout: 20_000 });

    await page.getByPlaceholder(/search name, email or phone/i).fill(email);
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByRole('button', { name: /deactivate/i }).click();

    const confirm = page.getByRole('dialog');
    // Confirming without a reason must not be possible.
    await confirm.getByRole('button', { name: /deactivate account/i }).click();
    await expect(confirm.getByText(/reason is required/i)).toBeVisible();

    await confirm.getByLabel(/reason/i).fill('Left the organisation');
    await confirm.getByRole('button', { name: /deactivate account/i }).click();

    await expect(confirm).toBeHidden({ timeout: 20_000 });

    // Scoped to the row under test: "Deactivated" also labels the status filter
    // and the header of the table, so a page-wide locator is ambiguous.
    await expect(
      page.getByRole('row').filter({ hasText: email }).getByText('Deactivated')
    ).toBeVisible({ timeout: 20_000 });

    // The reason is shown on the row, so the decision is explainable later.
    await expect(
      page.getByRole('row').filter({ hasText: email }).getByText('Left the organisation')
    ).toBeVisible();

    // And the account genuinely cannot sign in any more: the correct password is
    // refused because the account is suspended, not because the credential is wrong.
    await expectSignInRejected(page, email, SUSPENDED_PASSWORD);
  });

  test('deleting removes the account from the directory', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/users');

    const email = `delete.${RUN}@example.com`;

    await page.getByRole('button', { name: /create account/i }).click();
    const create = page.getByRole('dialog');
    await create.getByLabel('Role').selectOption({ label: 'Receptionist' });
    await create.getByLabel('Full name').fill(`Delete ${RUN}`);
    await create.getByLabel('Email').fill(email);
    await create.getByRole('button', { name: /create account/i }).click();
    await expect(create).toBeHidden({ timeout: 20_000 });

    await page.getByPlaceholder(/search name, email or phone/i).fill(email);
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByRole('button', { name: /^delete /i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /delete account/i }).click();

    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0, {
      timeout: 20_000,
    });
  });

  test('the admin cannot delete, deactivate or demote their own account', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/users');

    await page.getByPlaceholder(/search name, email or phone/i).fill(ADMIN_EMAIL!);

    const row = page.getByRole('row').filter({ hasText: ADMIN_EMAIL! });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // The controls are absent rather than merely disabled, so the impossible
    // actions cannot be discovered and clicked.
    await expect(row.getByRole('button', { name: /^delete /i })).toHaveCount(0);
    await expect(row.getByRole('button', { name: /^deactivate /i })).toHaveCount(0);
    await expect(row.getByLabel(/role for/i)).toBeDisabled();
  });

  test('the audit log records every lifecycle action', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/audit-log');

    // Filtered one action at a time: the unfiltered list shows only the most recent
    // page of entries, so asserting on it would depend on how much this run created.
    // Scoped away from the filter dropdown: the <option> carries the same text as
    // the badge on each entry, and an unscoped locator would match the option first.
    const entryBadge = (action: string) =>
      page
        .locator('main')
        .getByText(action, { exact: true })
        .and(page.locator('span, div'));

    for (const action of [
      'USER CREATED',
      'USER UPDATED',
      'USER DEACTIVATED',
      'USER DELETED',
      'ROLE CHANGED',
    ]) {
      await page.getByLabel('Filter by action').selectOption({ label: action });

      // Entries are cards rather than table rows, and each badge shows the action
      // with underscores replaced by spaces.
      await expect(entryBadge(action).first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test('a non-Super-Admin is redirected away from /admin/users', async ({ page }) => {
    // Signs in as the cashier created by the API suite (backend/e2e-run.ps1 seeds it
    // with a known password), then tries the admin route directly.
    const cashierEmail = process.env.E2E_CASHIER_EMAIL ?? 'cashier.one@example.com';
    const cashierPassword = process.env.E2E_CASHIER_PASSWORD ?? 'E2e@Clinic2026';

    await signIn(page, cashierEmail, cashierPassword);

    await page.goto('/admin/users');

    // The guard sends them to their own dashboard rather than rendering admin data.
    await expect(page).toHaveURL(/\/cashier/, { timeout: 20_000 });
    await expect(page.getByText('Role')).toHaveCount(0);
  });
});
