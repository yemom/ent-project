# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sidebar.spec.ts >> Sidebar navigation >> a role page reuses the shared directory, pre-filtered
- Location: e2e\sidebar.spec.ts:93:7

# Error details

```
Error: locator.fill: value: expected string, got undefined
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]: ⚕️
          - text: የ፟-mom clinic
        - paragraph [ref=e10]: Healthcare Suite
      - generic [ref=e11]:
        - heading "Next-Gen Patient Management" [level=2] [ref=e12]
        - paragraph [ref=e13]: Experience the clarity of data-driven healthcare with clinic's proprietary Glass-UI architecture.
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: ✓
            - generic [ref=e17]:
              - paragraph [ref=e18]: HIPAA Compliant
              - paragraph [ref=e19]: Secure patient data management
          - generic [ref=e20]:
            - generic [ref=e21]: ✓
            - generic [ref=e22]:
              - paragraph [ref=e23]: Real-time Sync
              - paragraph [ref=e24]: Instant updates across all devices
          - generic [ref=e25]:
            - generic [ref=e26]: ✓
            - generic [ref=e27]:
              - paragraph [ref=e28]: Role-Based Access
              - paragraph [ref=e29]: Admin, Doctor, and Patient portals
      - generic [ref=e35]:
        - paragraph [ref=e36]: Join 10,000+ professionals
        - paragraph [ref=e37]: Who trust clinic daily
    - generic [ref=e39]:
      - generic [ref=e40]:
        - heading "የ፟-mom clinic" [level=1] [ref=e41]
        - paragraph [ref=e42]: Secure access to your high-performance healthcare suite.
      - generic [ref=e43]:
        - generic [ref=e44]:
          - generic [ref=e45]: Email Address
          - textbox "Email Address" [ref=e50]:
            - /placeholder: dr.smith@clinic.com
        - generic [ref=e51]:
          - generic [ref=e52]: Security Password
          - generic [ref=e53]:
            - textbox "Security Password" [ref=e57]:
              - /placeholder: ••••••••
            - button [ref=e58] [cursor=pointer]
        - generic [ref=e63] [cursor=pointer]:
          - checkbox "Keep me authenticated for 24 hours" [ref=e64]
          - generic [ref=e65]: Keep me authenticated for 24 hours
        - link "Forgot password?" [ref=e67] [cursor=pointer]:
          - /url: /forgot-password
        - button "Sign In →" [ref=e68] [cursor=pointer]
      - generic [ref=e69]: OR CONTINUE WITH
      - generic [ref=e73]:
        - button "Google" [ref=e74] [cursor=pointer]
        - button "Passkey" [ref=e80] [cursor=pointer]
      - generic [ref=e84]:
        - link "Privacy Protocol" [ref=e85] [cursor=pointer]:
          - /url: "#"
        - generic [ref=e86]: •
        - link "HIPAA Compliance" [ref=e87] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e88]:
        - text: Don't have an account?
        - link "Sign up" [ref=e89] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e95] [cursor=pointer]
  - alert [ref=e99]
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Sidebar navigation, as a user experiences it with the config-driven navy sidebar.
  5   |  *
  6   |  * Tested against the Super Admin navigation structure:
  7   |  * - Dashboard
  8   |  * - Users & Staff ▸ All Users, Doctors, Nurses, Pharmacists, Cashiers, Receptionists, Lab Technicians, Patients
  9   |  * - Organization ▸ Branches, Departments, Wards & Rooms, Doctor Availability
  10  |  * - Operations ▸ Appointments, Laboratory, Pharmacy
  11  |  * - Finance ▸ Invoices, Payments, Refunds & Approvals
  12  |  * - Reports ▸ Patient Volume, Appointments, Revenue, Lab Turnaround, Pharmacy Stock
  13  |  * - Access Control ▸ Roles & Permissions, Approvals
  14  |  * - Audit Logs
  15  |  * - Settings
  16  |  */
  17  | test.describe('Sidebar navigation', () => {
  18  |   test.beforeEach(async ({ page }) => {
  19  |     await page.goto('/login');
> 20  |     await page.locator('#login-email').fill(process.env.SUPER_ADMIN_EMAIL!);
      |                                        ^ Error: locator.fill: value: expected string, got undefined
  21  |     await page.locator('#login-password').fill(process.env.SUPER_ADMIN_PASSWORD!);
  22  |     await page.getByRole('button', { name: /sign in|log in/i }).click();
  23  |     await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  24  |     await page.goto('/admin/users');
  25  |     await expect(page.getByRole('heading', { name: 'User accounts' })).toBeVisible();
  26  |   });
  27  | 
  28  |   test('toggles between expanded sidebar and icon rail on request', async ({ page }) => {
  29  |     const nav = page.getByRole('navigation', { name: 'Main navigation' });
  30  | 
  31  |     // Starts expanded by default
  32  |     await expect(nav.getByText('Users & Staff', { exact: true })).toBeVisible();
  33  |     await expect(nav.getByRole('link', { name: 'All Users' })).toBeVisible();
  34  | 
  35  |     // Collapse to rail
  36  |     const collapseBtn = page.getByRole('button', { name: /collapse navigation/i });
  37  |     if (await collapseBtn.isVisible()) {
  38  |       await collapseBtn.click();
  39  | 
  40  |       // In rail mode: icons carry aria-labels, text labels are hidden
  41  |       await expect(nav.getByRole('link', { name: 'Users & Staff' })).toBeVisible();
  42  |       await expect(nav.getByRole('link', { name: 'Finance' })).toBeVisible();
  43  |       await expect(nav.getByText('Doctors', { exact: true })).toHaveCount(0);
  44  | 
  45  |       // Expand back
  46  |       await page.getByRole('button', { name: /expand navigation/i }).click();
  47  |       await expect(nav.getByText('Users & Staff', { exact: true })).toBeVisible();
  48  |     }
  49  |   });
  50  | 
  51  |   test('an expanded sidebar groups every Super Admin area', async ({ page }) => {
  52  |     const nav = page.getByRole('navigation', { name: 'Main navigation' });
  53  | 
  54  |     // Every top-level area is present
  55  |     for (const area of [
  56  |       'Dashboard',
  57  |       'Users & Staff',
  58  |       'Organization',
  59  |       'Operations',
  60  |       'Finance',
  61  |       'Reports',
  62  |       'Access Control',
  63  |       'Audit Logs',
  64  |       'Settings',
  65  |     ]) {
  66  |       await expect(nav.getByText(area, { exact: true })).toBeVisible();
  67  |     }
  68  |   });
  69  | 
  70  |   test('the group containing the current page stays expanded', async ({ page }) => {
  71  |     const nav = page.getByRole('navigation', { name: 'Main navigation' });
  72  | 
  73  |     // The link for the open page (/admin/users) is auto-expanded and marked current
  74  |     const current = nav.getByRole('link', { name: 'All Users' });
  75  |     await expect(current).toBeVisible();
  76  |     await expect(current).toHaveAttribute('aria-current', 'page');
  77  |   });
  78  | 
  79  |   test('navigating through the sidebar works and moves the highlight', async ({ page }) => {
  80  |     const nav = page.getByRole('navigation', { name: 'Main navigation' });
  81  | 
  82  |     // Click Doctors link under Users & Staff
  83  |     await nav.getByRole('link', { name: 'Doctors' }).click();
  84  |     await expect(page).toHaveURL(/\/admin\/doctors/, { timeout: 20_000 });
  85  | 
  86  |     // Highlight moves to Doctors
  87  |     await expect(nav.getByRole('link', { name: 'Doctors' })).toHaveAttribute(
  88  |       'aria-current',
  89  |       'page'
  90  |     );
  91  |   });
  92  | 
  93  |   test('a role page reuses the shared directory, pre-filtered', async ({ page }) => {
  94  |     await page.goto('/admin/cashiers');
  95  | 
  96  |     // Same component as the main directory, but locked to one role: no role filter.
  97  |     await expect(page.getByRole('heading', { name: 'Cashiers' })).toBeVisible();
  98  |     await expect(page.getByLabel('Filter by role')).toHaveCount(0);
  99  |     await expect(page.getByLabel('Filter by status')).toBeVisible();
  100 |     await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  101 |   });
  102 | });
  103 | 
```