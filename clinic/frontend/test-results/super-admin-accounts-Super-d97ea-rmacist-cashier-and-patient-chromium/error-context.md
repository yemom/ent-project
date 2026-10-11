# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: super-admin-accounts.spec.ts >> Super Admin account management >> creates a doctor, nurse, pharmacist, cashier and patient
- Location: e2e\super-admin-accounts.spec.ts:98:7

# Error details

```
Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to run the E2E suite.
They are read from backend/.env.local, which is git-ignored. Start the backend with backend/e2e-start-and-run.ps1, which loads it.
```

# Test source

```ts
  1   | /**
  2   |  * Super Admin account management, end to end through the browser.
  3   |  *
  4   |  * <p>Credentials come from the environment, never from this file. A checked-in
  5   |  * password for a Super Admin would be a checked-in password for the deployment.
  6   |  *
  7   |  * <p>The backend must already be running — see backend/e2e-start-and-run.ps1. These
  8   |  * tests deliberately do not seed through the API first: the point is to prove the
  9   |  * screens themselves create the accounts.
  10  |  */
  11  | 
  12  | import { expect, test, type Page } from '@playwright/test';
  13  | 
  14  | const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  15  | const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
  16  | 
  17  | /** Unique per run so a re-run never collides with the previous run's accounts. */
  18  | const RUN = Math.random().toString(36).slice(2, 8);
  19  | 
  20  | /**
  21  |  * Password for the account the deactivation test suspends.
  22  |  *
  23  |  * <p>Throwaway by design: it exists only for this run, belongs to no real person,
  24  |  * and satisfies the password policy. A fixed value is required because the test has
  25  |  * to attempt a sign-in afterwards to prove the suspension is real.
  26  |  */
  27  | const SUSPENDED_PASSWORD = 'E2e@Suspended2026';
  28  | 
  29  | test.beforeAll(() => {
  30  |   if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
> 31  |     throw new Error(
      |           ^ Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to run the E2E suite.
  32  |       'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to run the E2E suite.\n' +
  33  |         'They are read from backend/.env.local, which is git-ignored. ' +
  34  |         'Start the backend with backend/e2e-start-and-run.ps1, which loads it.',
  35  |     );
  36  |   }
  37  | });
  38  | 
  39  | /**
  40  |  * Signs in and waits for the app shell.
  41  |  *
  42  |  * <p>Targets the input by id rather than by label text: the login form's labels are
  43  |  * localised ("Email Address" vs "Medical ID or Email"), so a label-based locator is
  44  |  * coupled to copy that changes for unrelated reasons.
  45  |  */
  46  | async function signIn(page: Page, email: string, password: string) {
  47  |   await page.goto('/login');
  48  |   await page.locator('#login-email').fill(email);
  49  |   await page.locator('#login-password').fill(password);
  50  |   await page.getByRole('button', { name: /sign in|log in/i }).click();
  51  |   await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  52  | }
  53  | 
  54  | /**
  55  |  * Attempts a sign-in that is expected to fail, and confirms we are still on /login.
  56  |  *
  57  |  * <p>A separate helper because {@link signIn} waits for a navigation away from the
  58  |  * login page — which never happens when the credentials are correctly refused. Used to
  59  |  * prove a suspended or deleted account genuinely cannot get in.
  60  |  */
  61  | async function expectSignInRejected(page: Page, email: string, password: string) {
  62  |   await page.goto('/login');
  63  |   await page.locator('#login-email').fill(email);
  64  |   await page.locator('#login-password').fill(password);
  65  |   await page.getByRole('button', { name: /sign in|log in/i }).click();
  66  | 
  67  |   // An error message appears and the URL does not change.
  68  |   await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
  69  |   await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  70  | }
  71  | 
  72  | async function openCreateDialog(page: Page, roleLabel: string) {
  73  |   await page.goto('/admin/users');
  74  |   await page.getByRole('button', { name: /create account/i }).click();
  75  |   const dialog = page.getByRole('dialog');
  76  |   await expect(dialog).toBeVisible();
  77  |   await dialog.getByLabel('Role').selectOption({ label: roleLabel });
  78  |   return dialog;
  79  | }
  80  | 
  81  | /**
  82  |  * Asserts an account is present in the directory, searching for it first.
  83  |  *
  84  |  * <p>The table paginates at 20 rows, and this database already holds accounts from the
  85  |  * API suite and earlier runs. Scrolling or paging to find a newly created account
  86  |  * would test the pagination controls rather than the creation, so the search box is
  87  |  * used instead — which is also how an administrator would actually find it.
  88  |  */
  89  | async function expectAccountVisible(page: Page, email: string) {
  90  |   const search = page.getByPlaceholder(/search name, email or phone/i);
  91  |   await search.fill(email);
  92  |   await expect(
  93  |     page.getByRole('row').filter({ hasText: email })
  94  |   ).toBeVisible({ timeout: 20_000 });
  95  | }
  96  | 
  97  | test.describe('Super Admin account management', () => {
  98  |   test('creates a doctor, nurse, pharmacist, cashier and patient', async ({ page }) => {
  99  |     await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  100 |     // Each entry carries every field its role requires, because the form refuses to
  101 |     // submit without them — that refusal is itself covered by its own test below.
  102 |     const accounts = [
  103 |       {
  104 |         role: 'Doctor',
  105 |         name: `Doctor ${RUN}`,
  106 |         email: `doctor.${RUN}@example.com`,
  107 |         extra: { Specialization: 'Cardiology', 'License number': `LIC-${RUN}` },
  108 |       },
  109 |       { role: 'Nurse', name: `Nurse ${RUN}`, email: `nurse.${RUN}@example.com`, extra: {} },
  110 |       {
  111 |         role: 'Pharmacist',
  112 |         name: `Pharmacist ${RUN}`,
  113 |         email: `pharmacist.${RUN}@example.com`,
  114 |         extra: { 'Employee number': `EMP-${RUN}` },
  115 |       },
  116 |       { role: 'Cashier', name: `Cashier ${RUN}`, email: `cashier.${RUN}@example.com`, extra: {} },
  117 |       {
  118 |         role: 'Patient',
  119 |         name: `Patient ${RUN}`,
  120 |         email: `patient.${RUN}@example.com`,
  121 |         extra: { 'Date of birth': '1990-05-20' },
  122 |       },
  123 |     ] as const;
  124 | 
  125 |     for (const account of accounts) {
  126 |       const dialog = await openCreateDialog(page, account.role);
  127 | 
  128 |       await dialog.getByLabel('Full name').fill(account.name);
  129 |       await dialog.getByLabel('Email').fill(account.email);
  130 |       // Password left blank on purpose: the server generates one and shows it once,
  131 |       // which is the behaviour the temporary-password requirement depends on.
```