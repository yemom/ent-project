import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';
import { fetchAllPages } from './page-utils';

/**
 * The appointment contract, mirrored from the server.
 *
 * <p>The previous declaration here claimed the API returned flat
 * `{ patientName, doctorName, scheduledAt, reason }` records. It never has:
 * `AppointmentResponse` carries nested `patient` / `doctor` objects, calls the
 * moment `appointmentDate`, and names the free-text field `reasonForVisit`.
 * Nothing in TypeScript caught it because the response was typed as
 * `AppointmentItem` rather than checked against the server, so every consumer read
 * `undefined` and rendered blank cells — the appointments list showed no patient,
 * no doctor and an invalid date.
 *
 * <p>`AppointmentItem` is kept as an alias so existing imports keep compiling.
 */
export interface AppointmentParty {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean | null;
  /** Front-desk registration number. Patients only. */
  registrationNumber: string | null;
  /** Clinician speciality. Doctors only. */
  specialization: string | null;
}

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

/** Statuses that still hold the doctor's slot. */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
];

/**
 * Statuses a given current status may move to.
 *
 * <p>Mirrors `ALLOWED_TRANSITIONS` in `AppointmentServiceImpl`. The server is the
 * authority and rejects anything not listed here; the UI uses the same list to
 * avoid offering an action that would come back as a 400.
 */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
};

export interface AppointmentRecord {
  id: string;
  patient: AppointmentParty | null;
  doctor: AppointmentParty | null;
  /** ISO-8601 local date-time, e.g. `2026-10-19T09:00:00`. */
  appointmentDate: string;
  /** Slot length in minutes. */
  duration: number | null;
  status: AppointmentStatus;
  reasonForVisit: string | null;
  notes: string | null;
  reminderSent: boolean | null;
  reminderSentAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  cancellationDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** @deprecated Use {@link AppointmentRecord}; the old name described a shape the API never had. */
export type AppointmentItem = AppointmentRecord;

export interface AppointmentCreatePayload {
  patientId: string;
  doctorId: string;
  /** ISO local date-time. Seconds are optional. */
  appointmentDate: string;
  duration: number;
  status?: string;
  reasonForVisit?: string;
  notes?: string;
}

export interface AppointmentUpdatePayload {
  patientId?: string;
  doctorId?: string;
  appointmentDate?: string;
  duration?: number;
  reasonForVisit?: string;
  notes?: string;
}

export interface AppointmentSearchParams {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  /** ISO local date-time, inclusive. */
  from?: string;
  /** ISO local date-time, inclusive. */
  to?: string;
  keyword?: string;
}

type ListParams = AppointmentSearchParams & { page?: number; size?: number };

/** Drops keys the caller left blank so an empty filter is never sent as `""`. */
function definedParams(params: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value as string | number;
  }
  return out;
}

/**
 * Lists appointments.
 *
 * <p>Uses `/appointments/search` whenever any filter is present and the plain
 * collection otherwise, which is what the server exposes; both return the same
 * envelope.
 */
export async function listAppointments(params: ListParams = {}): Promise<PageResponse<AppointmentRecord>> {
  const { page, size, ...filters } = params;
  const query = definedParams(filters);
  const endpoint = Object.keys(query).length > 0 ? '/appointments/search' : '/appointments';

  if (page !== undefined && size !== undefined) {
    const { data } = await apiClient.get<PageResponse<AppointmentRecord>>(endpoint, {
      params: { ...query, page, size },
    });
    return data;
  }

  return fetchAllPages(async (nextPage, nextSize) => {
    const { data } = await apiClient.get<PageResponse<AppointmentRecord>>(endpoint, {
      params: { ...query, page: nextPage, size: nextSize },
    });
    return data;
  });
}

export async function searchAppointments(
  params: AppointmentSearchParams = {},
): Promise<PageResponse<AppointmentRecord>> {
  return listAppointments(params);
}

export async function getAppointment(id: string): Promise<AppointmentRecord> {
  const { data } = await apiClient.get<AppointmentRecord>(`/appointments/${id}`);
  return data;
}

export async function createAppointment(payload: AppointmentCreatePayload): Promise<AppointmentRecord> {
  const { data } = await apiClient.post<AppointmentRecord>('/appointments', payload);
  return data;
}

/** Reschedules. The server refuses to carry a status through this endpoint. */
export async function updateAppointment(
  id: string,
  payload: AppointmentUpdatePayload,
): Promise<AppointmentRecord> {
  const { data } = await apiClient.put<AppointmentRecord>(`/appointments/${id}`, payload);
  return data;
}

export async function changeAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  reason?: string,
): Promise<AppointmentRecord> {
  const { data } = await apiClient.put<AppointmentRecord>(`/appointments/${id}/status`, {
    status,
    ...(reason ? { reason } : {}),
  });
  return data;
}

/**
 * Cancels, keeping the record and its audit trail.
 *
 * <p>A `DELETE` carrying a `reason` is how the API models a cancellation; omitting
 * the reason deletes the row outright, which is why this wrapper always sends one.
 */
export async function cancelAppointment(id: string, reason: string): Promise<void> {
  await apiClient.delete(`/appointments/${id}`, { params: { reason } });
}

// ---------------------------------------------------------------------------
// Display helpers, shared by every screen that lists appointments.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

const STATUS_VARIANTS: Record<AppointmentStatus, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  SCHEDULED: 'default',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  NO_SHOW: 'warning',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as AppointmentStatus] ?? status;
}

export function statusVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  return STATUS_VARIANTS[status as AppointmentStatus] ?? 'secondary';
}

/** `2026-10-19T09:00:00` → `09:00`. Empty when the value is missing or unparseable. */
export function formatTime(iso: string | null | undefined): string {
  const date = parseLocalDateTime(iso);
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Parses a local date-time string as *local* time.
 *
 * <p>`new Date('2026-10-19T09:00:00')` is already local per the ES spec, but
 * appending a `Z` first is what keeps this honest if a value ever arrives with an
 * explicit offset: the backend stores wall-clock time with no zone, so the browser
 * must not re-interpret it as UTC and shift the appointment by a day.
 */
function parseLocalDateTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const normalised = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(' ', 'T');
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string | null | undefined): string {
  const date = parseLocalDateTime(iso);
  if (!date) return '—';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parseLocalDateTime(iso);
  if (!date) return '—';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** Today in `yyyy-MM-dd`, for `<input type="date" min>` and date-range defaults. */
export function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/** Combines a `<input type="date">` value and a `<input type="time">` value. */
export function combineDateAndTime(date: string, time: string): string {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

/** The inverse, for pre-filling a reschedule form. */
export function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
  const date = parseLocalDateTime(iso);
  if (!date) return { date: '', time: '' };
  return {
    date: toDateInputValue(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}