'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  useDoctorDirectory,
  usePatientDirectory,
  type DirectoryDoctor,
  type DirectoryPatient,
} from './directory';
import { useAuthStore } from '@/store/auth-store';
import { PERMISSIONS } from '@/features/auth/permissions';
import { getApiErrorMessage, getFriendlyErrorMessage } from '@/lib/error-handler';

/**
 * Slot lengths the clinic offers.
 *
 * <p>The column is free-form on the server (any positive number of minutes), so
 * these are the defaults a desk actually books, not a hard limit.
 */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

export const DEFAULT_DURATION_MINUTES = 30;

export interface AppointmentFormValues {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  duration: number;
  reasonForVisit: string;
  notes: string;
}

export type AppointmentFormErrors = Partial<Record<keyof AppointmentFormValues, string>>;

/** Longest a booking can be, matching the server's conflict window. */
const MAX_DURATION_MINUTES = 480;

export function validateAppointmentForm(
  values: AppointmentFormValues,
  today: string,
): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {};

  if (!values.patientId.trim()) errors.patientId = 'Select a patient.';
  if (!values.doctorId.trim()) errors.doctorId = 'Select a doctor.';
  if (!values.date) {
    errors.date = 'Choose a date.';
  } else if (values.date < today) {
    errors.date = 'Appointments cannot be scheduled in the past.';
  }

  if (!values.time) {
    errors.time = 'Choose a start time.';
  } else if (values.date && values.time && `${values.date}T${values.time}` <= todayNowIso()) {
    errors.time = 'That slot has already passed. Choose a later time.';
  }

  if (!Number.isFinite(values.duration) || values.duration <= 0) {
    errors.duration = 'Enter a duration in minutes.';
  } else if (values.duration > MAX_DURATION_MINUTES) {
    errors.duration = `A single appointment cannot exceed ${MAX_DURATION_MINUTES} minutes.`;
  }

  return errors;
}

/** Current local time as `yyyy-MM-ddTHH:mm`, the precision the form edits at. */
function todayNowIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function todayDateInputValue(): string {
  return todayNowIso().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Type-ahead over the patient directory.
 *
 * <p>A `<select>` was not usable here: the list is the whole patient base, and a
 * native dropdown gives no way to narrow it. This renders the matches as buttons,
 * so each option can carry the registration number and phone — the two things that
 * tell a receptionist they have picked the right person — and remains fully
 * keyboard reachable.
 */
function PatientPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: DirectoryPatient | null;
  onChange: (patient: DirectoryPatient | null) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const [query, setQuery] = useState('');
  const { data, isFetching, isError } = usePatientDirectory(query);
  const matches = data ?? [];

  return (
    <div className="space-y-2">
      {value ? (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
            invalid ? 'border-red-300 bg-red-50/50' : 'border-primary bg-primary/5'
          }`}
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{value.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {value.registrationNumber ? `Reg. ${value.registrationNumber}` : 'No registration number'}
              {value.phone ? ` · ${value.phone}` : ''}
              {value.email ? ` · ${value.email}` : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Clear selected patient"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="appointment-patient-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or registration number..."
              className="pl-9"
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="appointment-patient-results"
              aria-invalid={invalid}
              aria-describedby={describedBy}
            />
          </div>

          <div
            id="appointment-patient-results"
            role="listbox"
            className="max-h-56 overflow-y-auto rounded-xl border border-border"
          >
            {query.trim().length < 2 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Type at least two characters to search registered patients.
              </p>
            ) : isError ? (
              <p className="px-3 py-4 text-sm text-red-600">
                The patient list could not be loaded. Check your connection and try again.
              </p>
            ) : isFetching && matches.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching...
              </p>
            ) : matches.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No registered patient matches “{query.trim()}”.
              </p>
            ) : (
              matches.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => onChange(patient)}
                  className="flex w-full flex-col items-start border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="font-medium">{patient.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {patient.registrationNumber ? `Reg. ${patient.registrationNumber}` : 'No registration number'}
                    {patient.phone ? ` · ${patient.phone}` : ''}
                    {patient.email ? ` · ${patient.email}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Doctor picker.
 *
 * <p>Shows the specialisation beside every name because "which doctor" at a front
 * desk is usually "which specialisation", and flags a doctor the server has marked
 * unavailable rather than hiding them — reception still needs to see who is on the
 * roster.
 */
function DoctorPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (doctorId: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const { data, isLoading, isError } = useDoctorDirectory();
  const doctors: DirectoryDoctor[] = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-input px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading doctors...
      </div>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        The doctor list could not be loaded. Refresh the page and try again.
      </p>
    );
  }

  return (
    <Select
      id="appointment-doctor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      disabled={doctors.length === 0}
    >
      <option value="">
        {doctors.length === 0 ? 'No doctors registered' : '-- Choose a doctor --'}
      </option>
      {doctors.map((doctor) => (
        <option key={doctor.id} value={doctor.id}>
          {doctor.fullName}
          {doctor.specialization ? ` — ${doctor.specialization}` : ''}
          {doctor.available === false ? ' (unavailable)' : ''}
        </option>
      ))}
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export interface AppointmentFormProps {
  /** `reschedule` hides the fields a reschedule cannot change. */
  mode: 'create' | 'reschedule';
  initialValues?: Partial<AppointmentFormValues>;
  submitLabel: string;
  submitting: boolean;
  /** Server-side failure to display above the fields. */
  submitError?: string | null;
  onSubmit: (values: AppointmentFormValues) => void;
  onCancel: () => void;
  today?: string;
}

/**
 * The booking form, shared by "Add appointment" and "Reschedule".
 *
 * <p>Client-side validation exists to give an immediate, field-level answer; the
 * server re-checks all of it. `submitError` carries the server's own message, so a
 * conflict discovered only on submit (another user booked the slot seconds earlier)
 * is reported in the server's words rather than being guessed at here.
 */
export function AppointmentForm({
  mode,
  initialValues,
  submitLabel,
  submitting,
  submitError,
  onSubmit,
  onCancel,
  today = todayDateInputValue(),
}: AppointmentFormProps) {
  const [values, setValues] = useState<AppointmentFormValues>(() => ({
    patientId: initialValues?.patientId ?? '',
    doctorId: initialValues?.doctorId ?? '',
    date: initialValues?.date ?? today,
    time: initialValues?.time ?? '09:00',
    duration: initialValues?.duration ?? DEFAULT_DURATION_MINUTES,
    reasonForVisit: initialValues?.reasonForVisit ?? '',
    notes: initialValues?.notes ?? '',
  }));
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const [touched, setTouched] = useState(false);

  // The patient's id is what is submitted; the picked record only supplies the
  // label shown back above the field. Kept in component state rather than derived
  // from the query so the selection survives the search result being refetched.
  const [selectedPatient, setSelectedPatient] = useState<DirectoryPatient | null>(null);

  useEffect(() => {
    if (!initialValues) return;
    setValues((current) => ({ ...current, ...initialValues }));
  }, [initialValues]);

  const canManageAppointments = useAuthStore((state) =>
    state.hasPermission(PERMISSIONS.APPOINTMENT_MANAGE),
  );

  const setField = <K extends keyof AppointmentFormValues>(
    key: K,
    value: AppointmentFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (touched) {
      setErrors(validateAppointmentForm({ ...values, [key]: value }, today));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    const found = validateAppointmentForm(values, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(values);
  };

  const showError = (key: keyof AppointmentFormValues) => (touched ? errors[key] : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {submitError}
        </div>
      ) : null}

      <Field
        label="Patient"
        htmlFor="appointment-patient-search"
        error={showError('patientId')}
        hint={
          // Only useful while the field is still empty; the selection chip above the
          // search box already says which patient this is.
          mode === 'reschedule' || selectedPatient ? undefined : 'Search registered patients by name or registration number.'
        }
      >
        <PatientPicker
          value={selectedPatient}
          onChange={(patient) => {
            setSelectedPatient(patient);
            setField('patientId', patient?.id ?? '');
          }}
          invalid={Boolean(showError('patientId'))}
          describedBy="appointment-patient-search-error"
        />
      </Field>

      <Field
        label="Doctor"
        htmlFor="appointment-doctor"
        error={showError('doctorId')}
      >
        <DoctorPicker
          value={values.doctorId}
          onChange={(doctorId) => setField('doctorId', doctorId)}
          invalid={Boolean(showError('doctorId'))}
          describedBy="appointment-doctor-error"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="appointment-date" error={showError('date')}>
          <Input
            id="appointment-date"
            type="date"
            // The server rejects past slots, so the picker does not offer them.
            min={today}
            value={values.date}
            onChange={(event) => setField('date', event.target.value)}
            aria-invalid={Boolean(showError('date'))}
            aria-describedby="appointment-date-error"
            required
          />
        </Field>

        <Field label="Start time" htmlFor="appointment-time" error={showError('time')}>
          <Input
            id="appointment-time"
            type="time"
            step={300}
            value={values.time}
            onChange={(event) => setField('time', event.target.value)}
            aria-invalid={Boolean(showError('time'))}
            aria-describedby="appointment-time-error"
            required
          />
        </Field>

        <Field label="Duration" htmlFor="appointment-duration" error={showError('duration')}>
          <Select
            id="appointment-duration"
            value={String(values.duration)}
            onChange={(event) => setField('duration', Number(event.target.value))}
            aria-invalid={Boolean(showError('duration'))}
            aria-describedby="appointment-duration-error"
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Reason for visit"
        htmlFor="appointment-reason"
        error={showError('reasonForVisit')}
      >
        <Input
          id="appointment-reason"
          value={values.reasonForVisit}
          onChange={(event) => setField('reasonForVisit', event.target.value)}
          placeholder="e.g. Annual check-up"
          maxLength={500}
          aria-describedby="appointment-reason-error"
        />
      </Field>

      <Field label="Notes" htmlFor="appointment-notes" hint="Optional. Visible to staff on the booking.">
        <textarea
          id="appointment-notes"
          value={values.notes}
          onChange={(event) => setField('notes', event.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>

      {!canManageAppointments && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your role can view this schedule but not book into it.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !canManageAppointments}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/** Turns a rejected mutation into the text the form shows above its fields. */
export function appointmentSubmitErrorMessage(error: unknown): string {
  return getFriendlyErrorMessage(
    error,
    getApiErrorMessage(error) || 'We could not save that appointment. Please try again.',
  );
}