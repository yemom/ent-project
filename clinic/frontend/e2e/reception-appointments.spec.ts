import { expect, test, type Page } from '@playwright/test';

/**
 * Reception → Appointments, driven against a stubbed API.
 *
 * <p>Written as a browser test rather than a unit test for the same reason as
 * `auth-contract.spec.ts`: the bugs this guards against are all at boundaries the
 * compiler cannot see. The screen used to render a placeholder, and the API client
 * it now uses used to declare a response shape (`patientName`, `scheduledAt`,
 * `reason`) the server has never sent — so every row rendered blank while still
 * compiling cleanly and passing any type check.
 *
 * <p>The API is stubbed at the network boundary, which is the only way to cover the
 * states a live database rarely produces on demand: an empty schedule, a failed
 * request, and a 409 raised by another user booking the same slot a moment before
 * the form was submitted. Those are exactly the paths that regress silently.
 *
 * <p>No credentials are needed, so this runs in any checkout. The real
 * authentication flow is covered by `auth-contract.spec.ts`, and server-side
 * behaviour by the backend's `RbacAccessControlTest` and
 * `scripts/verify-appointments.ps1`.
 */

const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:8090/api/v1';

const PERMISSIONS = [
  'patient:register',
  'patient:demographics:read',
  'patient:assign',
  'appointment:manage',
  'queue:manage',
  'checkin:write',
];

/** A page of records in the exact envelope `PageResponse` returns. */
function pageResponse(content: unknown[], totalElements = content.length) {
  return {
    content,
    pageNumber: 0,
    pageSize: 20,
    totalElements,
    totalPages: 1,
    first: true,
    last: true,
  };
}

function party(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    fullName: 'Wanjiru Kamau',
    email: 'wanjiru@example.com',
    role: 'PATIENT',
    active: true,
    registrationNumber: 'REG-4471',
    specialization: null,
    ...overrides,
  };
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    patient: party(),
    doctor: party({
      id: 'd-1',
      fullName: 'Dr Adaeze Okafor',
      email: 'doctor@example.com',
      role: 'DOCTOR',
      registrationNumber: null,
      specialization: 'Cardiology',
    }),
    appointmentDate: '2027-03-04T09:00:00',
    duration: 30,
    status: 'SCHEDULED',
    reasonForVisit: 'Annual check-up',
    notes: null,
    reminderSent: false,
    reminderSentAt: null,
    cancelledBy: null,
    cancellationReason: null,
    cancellationDate: null,
    createdAt: '2027-03-01T08:00:00',
    updatedAt: '2027-03-01T08:00:00',
    ...overrides,
  };
}

const PATIENT_DIRECTORY = pageResponse([
  party({ id: 'p-1' }),
  party({ id: 'p-2', fullName: 'Wanjiru Kamau Jr', registrationNumber: 'REG-9912' }),
]);

const DOCTOR_DIRECTORY = pageResponse([
  party({
    id: 'd-1',
    fullName: 'Dr Adaeze Okafor',
    email: 'doctor@example.com',
    role: 'DOCTOR',
    registrationNumber: null,
    specialization: 'Cardiology',
  }),
]);

type StubOptions = {
  appointments?: unknown[];
  /** Status the appointment list should answer with, for the failure path. */
  listStatus?: number;
  /** Status a booking POST should answer with. */
  createStatus?: number;
  createBody?: unknown;
  /** Records each POST /appointments body. */
  onCreate?: (body: any) => void;
  /** Records each list request URL, to prove filters reach the server. */
  onListRequest?: (url: string) => void;
  /** Holds the list response open, to observe the loading state. */
  gate?: Promise<void>;
};

/**
 * Stubs every API endpoint the page touches.
 *
 * <p>A single wildcard handler rather than one per endpoint: the shell fires several
 * requests on mount (profile refresh, notification badge, dashboard prefetch), and a
 * request that escapes to the real backend answers 401, which trips the client's
 * refresh-and-redirect path and bounces the browser to /login mid-test. One handler
 * makes "nothing reaches the network" a property of the test instead of something
 * every new assertion has to remember.
 */
async function stubApi(page: Page, options: StubOptions = {}) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, '');
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // The shell revalidates the profile on every mount, and a 401 here ends the
    // session, so this must always answer.
    if (path === '/auth/me') {
      return json(200, {
        id: 'r-1',
        fullName: 'Amina Yusuf',
        email: 'reception@example.com',
        role: 'RECEPTIONIST',
        active: true,
        permissions: PERMISSIONS,
      });
    }

    if (path === '/appointments' || path.startsWith('/appointments/')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        options.onCreate?.(body);
        if (options.createStatus && options.createStatus >= 400) {
          return json(options.createStatus, options.createBody ?? { message: 'Something went wrong.' });
        }
        return json(201, options.createBody ?? appointment({ id: 'a-new' }));
      }
      if (options.listStatus) {
        return json(options.listStatus, { message: 'We could not reach the scheduling service.' });
      }
      options.onListRequest?.(request.url());
      if (options.gate) await options.gate;
      return json(200, pageResponse(options.appointments ?? [appointment()]));
    }

    if (path === '/patients' || path.startsWith('/patients')) return json(200, PATIENT_DIRECTORY);
    if (path === '/doctors' || path.startsWith('/doctors')) return json(200, DOCTOR_DIRECTORY);

    if (path === '/notifications/unread-count') return json(200, 0);
    if (path.startsWith('/notifications')) return json(200, pageResponse([]));
    if (path.startsWith('/admin/role-requests')) return json(200, pageResponse([]));
    if (path.startsWith('/billing/refunds')) return json(200, pageResponse([]));
    if (path.startsWith('/front-desk')) return json(200, []);

    // Anything else answers plausibly rather than 404, so an unexpected request
    // shows up as missing data instead of an unexplained failure.
    return json(200, pageResponse([]));
  });
}

/**
 * Seeds a receptionist session before the app's own hydration clears it.
 *
 * <p>Two places hold the session and both are needed:
 * <ul>
 *   <li>`clinic-auth` in localStorage, which the Zustand store persists to.</li>
 *   <li>`clinic.auth` / `clinic.role` cookies, which the Next middleware reads
 *       before it will serve a `/reception/*` route at all. Without them the request
 *       is redirected to /login before any React code runs.</li>
 * </ul>
 */
async function signInAsReceptionist(page: Page, baseURL: string) {
  await page.context().addCookies([
    { name: 'clinic.auth', value: '1', url: baseURL },
    { name: 'clinic.role', value: 'RECEPTIONIST', url: baseURL },
  ]);

  await page.addInitScript((granted) => {
    const user = {
      id: 'r-1',
      fullName: 'Amina Yusuf',
      email: 'reception@example.com',
      role: 'RECEPTIONIST',
      permissions: granted,
    };
    window.localStorage.setItem(
      'clinic-auth',
      JSON.stringify({ state: { user, accessToken: 'stub-access-token', refreshToken: null }, version: 0 }),
    );
    // `token-storage` keeps the token in sessionStorage; the hydrator reads from
    // there, not from the persisted store.
    window.sessionStorage.setItem('clinic.accessToken', 'stub-access-token');
    window.sessionStorage.setItem('clinic.user', JSON.stringify(user));
  }, PERMISSIONS);
}

async function gotoAppointments(page: Page) {
  await page.goto('/reception/appointments');
  await expect(page.getByRole('heading', { name: 'Appointments', level: 1 })).toBeVisible();
}

/** Opens the booking dialog and picks the first patient and the doctor. */
async function fillBookingForm(page: Page) {
  // The header and the card header both carry the action; either opens the dialog.
  await page.getByRole('button', { name: 'Add appointment' }).first().click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Patient').fill('Wanjiru');
  // Asserted before the selection collapses the list: the registration number is
  // what proves the directory data reached the screen.
  await expect(dialog.getByRole('option').first()).toContainText('Reg. REG-4471');
  await dialog.getByRole('option').first().click();

  await dialog.getByLabel('Doctor').selectOption('d-1');
  return dialog;
}

test.describe('Reception appointments', () => {
  test('the placeholder is gone and the schedule is rendered from the API', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page);
    await gotoAppointments(page);

    await expect(page.getByText('This area reuses the existing scheduling screens')).toHaveCount(0);

    // Every field the list promises, read from the real response shape.
    // Scoped to the table: the same names also appear inside the doctor filter's
    // <option> elements, which are hidden and would otherwise match first.
    const table = page.getByRole('table');
    await expect(table.getByRole('cell', { name: /Wanjiru Kamau/ })).toBeVisible();
    await expect(table.getByText('Reg. REG-4471')).toBeVisible();
    await expect(table.getByText('Dr Adaeze Okafor')).toBeVisible();
    await expect(table.getByText('Cardiology')).toBeVisible();
    await expect(table.getByText('Annual check-up')).toBeVisible();
    await expect(table.getByText('Scheduled')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Add appointment' }).first()).toBeVisible();
  });

  test('shows a loading skeleton before the data arrives', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await stubApi(page, { gate });

    await page.goto('/reception/appointments');
    await expect(page.getByText('Loading appointments…').first()).toBeVisible();
    release?.();
    await expect(page.getByRole('cell', { name: /Wanjiru Kamau/ })).toBeVisible();
  });

  test('an empty schedule offers the booking action', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page, { appointments: [] });
    await gotoAppointments(page);

    await expect(page.getByText('No appointments scheduled yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add appointment' }).first()).toBeVisible();
  });

  test('a failed request shows a message and a retry, not a blank screen', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page, { listStatus: 503 });
    await gotoAppointments(page);

    await expect(page.getByText('Appointments could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('the booking dialog requires a patient and a doctor', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    const created: any[] = [];
    await stubApi(page, { onCreate: (body) => created.push(body) });
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Add appointment' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add appointment' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Book appointment' }).click();

    await expect(dialog.getByText('Select a patient.')).toBeVisible();
    await expect(dialog.getByText('Select a doctor.')).toBeVisible();
    // Validation failed, so nothing was sent.
    expect(created).toHaveLength(0);
  });

  test('books an appointment from real directories and refreshes the list', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    const created: any[] = [];
    const listings: string[] = [];
    await stubApi(page, {
      appointments: [],
      onCreate: (body) => created.push(body),
      onListRequest: (url) => listings.push(url),
      // Answer with the persisted record, so the refresh has something to show.
      createBody: appointment({ id: 'a-new', reasonForVisit: 'Follow-up' }),
    });
    await gotoAppointments(page);

    const dialog = await fillBookingForm(page);

    // The doctor list comes from `/doctors/search`, specialisation included.
    await expect(dialog.getByLabel('Doctor').locator('option', { hasText: 'Cardiology' })).toHaveCount(1);

    await dialog.getByLabel('Date').fill('2027-03-04');
    await dialog.getByLabel('Start time').fill('11:30');
    await dialog.getByLabel('Duration').selectOption('45');
    await dialog.getByLabel('Reason for visit').fill('Follow-up');

    const listingsBefore = listings.length;
    await dialog.getByRole('button', { name: 'Book appointment' }).click();
    await expect(dialog).toBeHidden();

    // Exactly one booking, addressed to the ids the dialogs selected.
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      patientId: 'p-1',
      doctorId: 'd-1',
      duration: 45,
      reasonForVisit: 'Follow-up',
    });
    // The API takes a local date-time; seconds are sent so the payload is explicit.
    expect(created[0].appointmentDate).toBe('2027-03-04T11:30:00');

    // And the list re-reads rather than patching local state.
    await expect.poll(() => listings.length).toBeGreaterThan(listingsBefore);
  });

  test('refuses to submit a past appointment', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    const created: any[] = [];
    await stubApi(page, { onCreate: (body) => created.push(body) });
    await gotoAppointments(page);

    const dialog = await fillBookingForm(page);
    // Bypass the input's own `min` to prove the rule lives in the form, not the widget.
    await dialog.getByLabel('Date').fill('2020-01-01');
    await dialog.getByRole('button', { name: 'Book appointment' }).click();

    await expect(dialog.getByText('Appointments cannot be scheduled in the past.')).toBeVisible();
    expect(created).toHaveLength(0);
  });

  test('surfaces the server message when the slot was taken first', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page, {
      createStatus: 409,
      createBody: {
        message: 'This doctor is already booked from 2027-03-04T11:30 to 2027-03-04T12:15.',
      },
    });
    await gotoAppointments(page);

    const dialog = await fillBookingForm(page);
    await dialog.getByLabel('Date').fill('2027-03-04');
    await dialog.getByRole('button', { name: 'Book appointment' }).click();

    // The conflict is reported in the server's words, and the dialog stays open so
    // the user can pick another slot instead of retyping the form.
    await expect(dialog.getByText(/already booked from/)).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('shows the details of an appointment', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page);
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'View' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Appointment details' })).toBeVisible();
    await expect(dialog.getByText('REG-4471')).toBeVisible();
    await expect(dialog.getByText('Cardiology')).toBeVisible();
    await expect(dialog.getByText('Annual check-up')).toBeVisible();
  });

  test('cancelling requires a confirmation and a reason', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page);
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Cancel appointment' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Cancel this appointment?' })).toBeVisible();

    // Destructive action stays disabled until a reason is given.
    const confirm = dialog.getByRole('button', { name: 'Cancel appointment' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Reason/).fill('Patient called to cancel');
    await expect(confirm).toBeEnabled();
  });

  test('a completed appointment offers no status or cancel action', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page, { appointments: [appointment({ status: 'COMPLETED' })] });
    await gotoAppointments(page);

    await expect(page.getByRole('table').getByText('Completed')).toBeVisible();
    // COMPLETED is terminal, so there is nothing left to move it to and nothing
    // left to free. `exact` matters: the column sort button's name is
    // "Status Sort by Status", which contains "Status".
    await expect(page.getByRole('button', { name: 'Cancel appointment' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);
  });

  test('filters by status and sends the query to the server', async ({ page, baseURL }) => {
    await signInAsReceptionist(page, baseURL!);
    const requested: string[] = [];
    await stubApi(page, { onListRequest: (url) => requested.push(url) });
    await gotoAppointments(page);

    await page.getByLabel('Status').first().selectOption('CANCELLED');
    await expect.poll(() => requested.some((url) => url.includes('status=CANCELLED'))).toBe(true);
  });

  test('renders as cards on a narrow viewport', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsReceptionist(page, baseURL!);
    await stubApi(page);
    await gotoAppointments(page);

    // The six-column table is display:none below `md`, so the card list is what
    // remains: assert against the list items rather than the hidden table cells.
    const cards = page.locator('ul > li');
    await expect(cards.first()).toContainText('Wanjiru Kamau');
    await expect(cards.first()).toContainText('Annual check-up');
    await expect(cards.first().getByRole('button', { name: 'Reschedule' })).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
  });
});