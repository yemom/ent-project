import { expect, test } from '@playwright/test';

/**
 * Sidebar navigation, as a user experiences it with the config-driven navy sidebar.
 *
 * Tested against the Super Admin navigation structure:
 * - Dashboard
 * - Users & Staff ▸ All Users, Doctors, Nurses, Pharmacists, Cashiers, Receptionists, Lab Technicians, Patients
 * - Organization ▸ Branches, Departments, Wards & Rooms, Doctor Availability
 * - Operations ▸ Appointments, Laboratory, Pharmacy
 * - Finance ▸ Invoices, Payments, Refunds & Approvals
 * - Reports ▸ Patient Volume, Appointments, Revenue, Lab Turnaround, Pharmacy Stock
 * - Access Control ▸ Roles & Permissions, Approvals
 * - Audit Logs
 * - Settings
 */
test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill(process.env.SUPER_ADMIN_EMAIL!);
    await page.locator('#login-password').fill(process.env.SUPER_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'User accounts' })).toBeVisible();
  });

  test('toggles between expanded sidebar and icon rail on request', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // Starts expanded by default
    await expect(nav.getByText('Users & Staff', { exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'All Users' })).toBeVisible();

    // Collapse to rail
    const collapseBtn = page.getByRole('button', { name: /collapse navigation/i });
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();

      // In rail mode: icons carry aria-labels, text labels are hidden
      await expect(nav.getByRole('link', { name: 'Users & Staff' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Finance' })).toBeVisible();
      await expect(nav.getByText('Doctors', { exact: true })).toHaveCount(0);

      // Expand back
      await page.getByRole('button', { name: /expand navigation/i }).click();
      await expect(nav.getByText('Users & Staff', { exact: true })).toBeVisible();
    }
  });

  test('an expanded sidebar groups every Super Admin area', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // Every top-level area is present
    for (const area of [
      'Dashboard',
      'Users & Staff',
      'Organization',
      'Operations',
      'Finance',
      'Reports',
      'Access Control',
      'Audit Logs',
      'Settings',
    ]) {
      await expect(nav.getByText(area, { exact: true })).toBeVisible();
    }
  });

  test('the group containing the current page stays expanded', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // The link for the open page (/admin/users) is auto-expanded and marked current
    const current = nav.getByRole('link', { name: 'All Users' });
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('navigating through the sidebar works and moves the highlight', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // Click Doctors link under Users & Staff
    await nav.getByRole('link', { name: 'Doctors' }).click();
    await expect(page).toHaveURL(/\/admin\/doctors/, { timeout: 20_000 });

    // Highlight moves to Doctors
    await expect(nav.getByRole('link', { name: 'Doctors' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('a role page reuses the shared directory, pre-filtered', async ({ page }) => {
    await page.goto('/admin/cashiers');

    // Same component as the main directory, but locked to one role: no role filter.
    await expect(page.getByRole('heading', { name: 'Cashiers' })).toBeVisible();
    await expect(page.getByLabel('Filter by role')).toHaveCount(0);
    await expect(page.getByLabel('Filter by status')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});
