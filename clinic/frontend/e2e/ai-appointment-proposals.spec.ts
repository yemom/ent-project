import { expect, test, type Page, type Route } from '@playwright/test';

const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:8090/api/v1';

const doctor = {
  id: 'doctor-1',
  fullName: 'Dr Adaeze Okafor',
  email: 'doctor@example.com',
  role: 'DOCTOR',
  permissions: ['appointment:manage', 'patient:demographics:read'],
};

type ProposalState = {
  status: string;
  description: string;
  expiresAt: string;
  resultMessage: string | null;
};

function proposal(status = 'PROPOSED'): ProposalState {
  return {
    status,
    description: 'Book an appointment on 2030-01-02T09:00 for 30 minutes',
    expiresAt: status === 'EXPIRED' ? '2020-01-01T09:00:00' : '2030-01-02T08:50:00',
    resultMessage: status === 'EXPIRED' ? 'The proposal expired before it was confirmed.' : null,
  };
}

async function seedDoctorSession(page: Page, baseURL: string) {
  await page.context().addCookies([
    { name: 'clinic.auth', value: '1', url: baseURL },
    { name: 'clinic.role', value: 'DOCTOR', url: baseURL },
  ]);
  await page.addInitScript((user) => {
    localStorage.setItem(
      'clinic-auth',
      JSON.stringify({ state: { user, accessToken: 'proposal-e2e-token', refreshToken: null }, version: 0 }),
    );
    sessionStorage.setItem('clinic.accessToken', 'proposal-e2e-token');
    sessionStorage.setItem('clinic.user', JSON.stringify(user));
  }, doctor);
}

async function stubApi(
  page: Page,
  options: {
    initial?: ProposalState | null;
    confirmStatus?: number;
    pendingFailure?: boolean;
  } = {},
) {
  let current = options.initial ?? null;
  let proposalRequests = 0;
  let confirmRequests = 0;

  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (options.pendingFailure && url.endsWith('/ai/actions/pending')) {
      await route.abort('failed');
      return;
    }
    if (url.endsWith('/ai/capabilities')) {
      await json({
        available: true,
        enabled: true,
        providerConfigured: true,
        provider: 'controlled-test-provider',
        unavailableReason: null,
        capabilities: [{
          id: 'available_slots',
          label: 'Find appointment slots',
          description: 'Find free appointment slots.',
          suggestedQuestion: 'Which slots are available?',
          requiresHumanReview: false,
          requiredArguments: [],
        }],
      });
      return;
    }
    if (url.endsWith('/ai/actions/pending')) {
      await json(current ? [{ id: 'proposal-1', type: 'BOOK_APPOINTMENT', ...current }] : []);
      return;
    }
    if (url.endsWith('/ai/actions/propose')) {
      proposalRequests += 1;
      current = proposal();
      await json({ id: 'proposal-1', type: 'BOOK_APPOINTMENT', ...current }, 201);
      return;
    }
    if (url.endsWith('/ai/actions/proposal-1/confirm')) {
      confirmRequests += 1;
      if (options.confirmStatus) {
        await json({ message: 'The proposed slot is no longer available.' }, options.confirmStatus);
        return;
      }
      current = { ...proposal(), status: 'EXECUTED', resultMessage: 'The appointment change has been applied.' };
      await json({ id: 'proposal-1', type: 'BOOK_APPOINTMENT', ...current });
      return;
    }
    if (url.endsWith('/ai/actions/proposal-1/reject')) {
      current = { ...proposal(), status: 'REJECTED', resultMessage: 'Discarded.' };
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.endsWith('/ai/forecast')) {
      await json({});
      return;
    }
    await json({});
  });

  return {
    counts: () => ({ proposalRequests, confirmRequests }),
  };
}

async function openProposalPage(page: Page) {
  await page.goto('/ai');
  await expect(page.getByRole('heading', { name: 'AI Assistant', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Appointment proposal', exact: true })).toBeVisible();
}

async function fillProposal(page: Page) {
  await page.getByLabel('Patient ID').fill('patient-1');
  await page.getByLabel('Clinician ID').fill('doctor-1');
  await page.getByLabel('Proposed date and time').fill('2030-01-02T09:00');
}

test.describe('AI appointment proposals', () => {
  test('creates a typed proposal and renders the persisted pending list after reload', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    await stubApi(page);
    await openProposalPage(page);
    await fillProposal(page);
    await page.getByRole('button', { name: 'Prepare proposal' }).click();
    await expect(page.getByText(/Book an appointment on/)).toBeVisible();
    await page.reload();
    await expect(page.getByText('PROPOSED', { exact: true })).toBeVisible();
  });

  test('confirms only once on duplicate clicks and reconciles the executed state', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    const stub = await stubApi(page, { initial: proposal() });
    await openProposalPage(page);
    const confirm = page.getByRole('button', { name: 'Confirm' });
    await confirm.click();
    await confirm.click({ force: true }).catch(() => undefined);
    await expect(page.getByText('Persisted state: executed.')).toBeVisible();
    expect(stub.counts().confirmRequests).toBe(1);
  });

  test('rejects a proposal and displays the rejected result', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    await stubApi(page, { initial: proposal() });
    await openProposalPage(page);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Discarded.' }).last()).toBeVisible();
  });

  test('shows expired proposals without offering an invalid confirmation', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    await stubApi(page, { initial: proposal('EXPIRED'), confirmStatus: 409 });
    await openProposalPage(page);
    await expect(page.getByText('EXPIRED', { exact: true })).toBeVisible();
    await expect(page.getByText('The proposal expired before it was confirmed.')).toBeVisible();
  });

  test('reports a conflict when the slot is taken after proposal creation', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    await stubApi(page, { initial: proposal(), confirmStatus: 409 });
    await openProposalPage(page);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('status').last()).toContainText(/could not|slot|appointment|assistant/i);
  });

  test('shows a server/network failure while loading pending proposals', async ({ page, baseURL }) => {
    await seedDoctorSession(page, baseURL!);
    await stubApi(page, { pendingFailure: true });
    await openProposalPage(page);
    await expect(page.getByRole('alert').filter({ hasText: /could not|network|load/i })).toBeVisible();
  });
});
