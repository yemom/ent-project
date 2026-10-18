'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarPlus,
  Filter,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layouts/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AppointmentForm,
  appointmentSubmitErrorMessage,
  todayDateInputValue,
  type AppointmentFormValues,
} from './appointment-form';
import {
  useAppointments,
  useCancelAppointment,
  useChangeAppointmentStatus,
  useCreateAppointment,
  useUpdateAppointment,
} from './hooks';
import { useDoctorDirectory } from './directory';
import {
  APPOINTMENT_STATUS_TRANSITIONS,
  combineDateAndTime,
  formatDate,
  formatDateTime,
  formatTime,
  splitDateTime,
  statusLabel,
  statusVariant,
  type AppointmentRecord,
  type AppointmentSearchParams,
  type AppointmentStatus,
} from '@/services/api/appointments';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { useAuthStore } from '@/store/auth-store';
import { PERMISSIONS } from '@/features/auth/permissions';

/** Rows per page. Matches the server's default so the first paint is the real page. */
const PAGE_SIZE = 20;

type SortKey = 'appointmentDate' | 'patient' | 'doctor' | 'status';

interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

/** Which dialog, if any, is open. `null` means the list is showing. */
type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'reschedule'; appointment: AppointmentRecord }
  | { kind: 'details'; appointment: AppointmentRecord }
  | { kind: 'status'; appointment: AppointmentRecord }
  | { kind: 'cancel'; appointment: AppointmentRecord };

/**
 * Reception → Appointments.
 *
 * <p>Replaces a screen that said "This area reuses the existing scheduling screens"
 * and linked nowhere. Everything here reads and writes the real
 * `/api/v1/appointments` endpoints: the list is the server's, the patient and
 * doctor pickers are the server's directories, and every mutation re-fetches the
 * list afterwards so what is on screen is what was persisted.
 *
 * <p>Actions are gated on `appointment:manage`, the same permission the backend
 * enforces. That is presentation, not security — the API is the authority and will
 * refuse regardless of what is rendered.
 */
export function ReceptionAppointmentsPage() {
  const canManage = useAuthStore((state) => state.hasPermission(PERMISSIONS.APPOINTMENT_MANAGE));
  const role = useAuthStore((state) => state.user?.role);
  // Patients hold `appointment:manage` too, but may only cancel their own booking —
  // never confirm, complete or reschedule it. Mirrors the server's guard.
  const canChangeStatus = canManage && role !== 'PATIENT';

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [doctorId, setDoctorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: 'appointmentDate', direction: 'desc' });
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [status_message, setStatusMessage] = useState<StatusType>(null);
  const [banner, setBanner] = useState('');

  const searchParams = useMemo<AppointmentSearchParams>(() => {
    const params: AppointmentSearchParams = {};
    if (status) params.status = status;
    if (doctorId) params.doctorId = doctorId;
    if (keyword.trim()) params.keyword = keyword.trim();
    // The API takes half-open-free local date-times; a date picker sends a bare
    // date, so the bounds are widened to cover the whole day.
    if (dateFrom) params.from = `${dateFrom}T00:00:00`;
    if (dateTo) params.to = `${dateTo}T23:59:59`;
    return params;
  }, [status, doctorId, keyword, dateFrom, dateTo]);

  const query = useAppointments(searchParams);
  const doctors = useDoctorDirectory();

  const totalElements = query.data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));

  const sorted = useMemo(() => {
    // Read inside the memo rather than above it: `?? []` would otherwise build a
    // new array on every render and re-sort on every keystroke elsewhere on the page.
    const rows = query.data?.content ?? [];
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sort.key) {
        case 'patient':
          return (a.patient?.fullName ?? '').localeCompare(b.patient?.fullName ?? '') * direction;
        case 'doctor':
          return (a.doctor?.fullName ?? '').localeCompare(b.doctor?.fullName ?? '') * direction;
        case 'status':
          return a.status.localeCompare(b.status) * direction;
        case 'appointmentDate':
        default:
          return (a.appointmentDate ?? '').localeCompare(b.appointmentDate ?? '') * direction;
      }
    });
  }, [query.data, sort]);

  const hasFilters = Boolean(status || doctorId || keyword.trim() || dateFrom || dateTo);

  function resetFilters() {
    setKeyword('');
    setStatus('');
    setDoctorId('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'appointmentDate' ? 'desc' : 'asc' },
    );
  }

  function sortIndicator(key: SortKey) {
    if (sort.key !== key) return null;
    return <span aria-hidden>{sort.direction === 'asc' ? ' ▲' : ' ▼'}</span>;
  }

  function announce(message: string) {
    setBanner(message);
    setStatusMessage('success');
  }

  function reportFailure(error: unknown, fallback: string) {
    setStatusMessage('error');
    setBanner(getFriendlyErrorMessage(error, fallback));
  }

  // -----------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------

  const create = useCreateAppointment();
  const reschedule = useUpdateAppointment();
  const changeStatus = useChangeAppointmentStatus();
  const cancel = useCancelAppointment();

  async function handleCreate(values: AppointmentFormValues) {
    try {
      await create.mutateAsync({
        patientId: values.patientId,
        doctorId: values.doctorId,
        appointmentDate: combineDateAndTime(values.date, values.time),
        duration: values.duration,
        reasonForVisit: values.reasonForVisit.trim() || undefined,
        notes: values.notes.trim() || undefined,
      });
      setDialog({ kind: 'none' });
      toast.success('Appointment booked.');
      announce('Appointment booked and added to the schedule.');
    } catch (error) {
      reportFailure(error, 'We could not book that appointment. Please try again.');
    }
  }

  async function handleReschedule(appointment: AppointmentRecord, values: AppointmentFormValues) {
    try {
      await reschedule.mutateAsync({
        id: appointment.id,
        payload: {
          // The patient is fixed on a reschedule: changing who a slot belongs to is
          // a different action, and the dialog does not offer it.
          appointmentDate: combineDateAndTime(values.date, values.time),
          duration: values.duration,
          reasonForVisit: values.reasonForVisit.trim() || undefined,
          notes: values.notes.trim() || undefined,
        },
      });
      setDialog({ kind: 'none' });
      toast.success('Appointment rescheduled.');
      announce(`Appointment for ${appointment.patient?.fullName ?? 'the patient'} rescheduled.`);
    } catch (error) {
      reportFailure(error, 'We could not move that appointment. Please try another slot.');
    }
  }

  async function handleStatusChange(appointment: AppointmentRecord, next: AppointmentStatus) {
    try {
      await changeStatus.mutateAsync({ id: appointment.id, status: next });
      setDialog({ kind: 'none' });
      toast.success(`Appointment marked ${statusLabel(next).toLowerCase()}.`);
      announce(`Appointment marked ${statusLabel(next).toLowerCase()}.`);
    } catch (error) {
      reportFailure(error, 'We could not update that appointment’s status.');
    }
  }

  async function handleCancel(appointment: AppointmentRecord, reason: string) {
    try {
      await cancel.mutateAsync({ id: appointment.id, reason });
      setDialog({ kind: 'none' });
      toast.success('Appointment cancelled.');
      announce(`Appointment for ${appointment.patient?.fullName ?? 'the patient'} cancelled.`);
    } catch (error) {
      reportFailure(error, 'We could not cancel that appointment.');
    }
  }

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  const activeDialog = dialog.kind;
  const dialogAppointment = 'appointment' in dialog ? dialog.appointment : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Book, reschedule and cancel patient visits from the front desk."
        actionLabel={canManage ? 'Add appointment' : undefined}
        onAction={canManage ? () => setDialog({ kind: 'create' }) : undefined}
      />

      <StatusAlert
        status={status_message}
        message={banner}
        onDismiss={() => setStatusMessage(null)}
        autoDismissMs={6000}
      />

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" /> Schedule
              </CardTitle>
              <CardDescription>
                {query.isLoading
                  ? 'Loading appointments…'
                  : `${totalElements} appointment${totalElements === 1 ? '' : 's'}${
                      hasFilters ? ' match your filters' : ''
                    }`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <Button onClick={() => setDialog({ kind: 'create' })}>
                  <CalendarPlus className="h-4 w-4" /> Add appointment
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                aria-label="Refresh appointments"
                title="Refresh"
              >
                {query.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5 xl:col-span-2">
              <Label htmlFor="appointment-filter-keyword">Search</Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="appointment-filter-keyword"
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Reason or notes…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-filter-status">Status</Label>
              <Select
                id="appointment-filter-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AppointmentStatus | '');
                  setPage(0);
                }}
              >
                <option value="">All statuses</option>
                {(Object.keys(APPOINTMENT_STATUS_TRANSITIONS) as AppointmentStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-filter-doctor">Doctor</Label>
              <Select
                id="appointment-filter-doctor"
                value={doctorId}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setPage(0);
                }}
                disabled={doctors.isLoading}
              >
                <option value="">All doctors</option>
                {(doctors.data ?? []).map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-filter-from">From</Label>
              <Input
                id="appointment-filter-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(0);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-filter-to">To</Label>
              <Input
                id="appointment-filter-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(0);
                }}
              />
            </div>

            <div className="flex items-end md:col-span-2 xl:col-span-6">
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4" /> Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {query.isError ? (
            <ErrorState
              title="Appointments could not be loaded"
              message={
                getFriendlyErrorMessage(
                  query.error,
                  'We could not reach the scheduling service. Please try again.',
                )
              }
              onRetry={() => void query.refetch()}
            />
          ) : query.isLoading ? (
            <AppointmentTableSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState hasFilters={hasFilters} canManage={canManage} onReset={resetFilters} onAdd={() => setDialog({ kind: 'create' })} />
          ) : (
            <>
              {/* Desktop: a table is the densest readable layout for this many columns. */}
              <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Patient" sortKey="patient" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} indicator={sortIndicator} />
                      <SortableHead label="Doctor" sortKey="doctor" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} indicator={sortIndicator} />
                      <SortableHead label="Date & time" sortKey="appointmentDate" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} indicator={sortIndicator} />
                      <TableHead>Reason</TableHead>
                      <SortableHead label="Status" sortKey="status" activeKey={sort.key} direction={sort.direction} onSort={toggleSort} indicator={sortIndicator} />
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>
                          <p className="font-medium">{appointment.patient?.fullName ?? 'Unknown patient'}</p>
                          {appointment.patient?.registrationNumber ? (
                            <p className="text-xs text-muted-foreground">
                              Reg. {appointment.patient.registrationNumber}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p>{appointment.doctor?.fullName ?? 'Unknown doctor'}</p>
                          {appointment.doctor?.specialization ? (
                            <p className="text-xs text-muted-foreground">
                              {appointment.doctor.specialization}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p>{formatDate(appointment.appointmentDate)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(appointment.appointmentDate)}
                            {appointment.duration ? ` · ${appointment.duration} min` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="line-clamp-2">
                            {appointment.reasonForVisit || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={appointment.status} />
                        </TableCell>
                        <TableCell>
                          <RowActions
                            appointment={appointment}
                            canManage={canManage}
                            canChangeStatus={canChangeStatus}
                            onView={() => setDialog({ kind: 'details', appointment })}
                            onReschedule={() => setDialog({ kind: 'reschedule', appointment })}
                            onStatus={() => setDialog({ kind: 'status', appointment })}
                            onCancel={() => setDialog({ kind: 'cancel', appointment })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: a table of six columns is unusable, so the same data becomes cards. */}
              <ul className="space-y-3 md:hidden">
                {sorted.map((appointment) => (
                  <li key={appointment.id}>
                    <AppointmentCard
                      appointment={appointment}
                      canManage={canManage}
                      canChangeStatus={canChangeStatus}
                      onView={() => setDialog({ kind: 'details', appointment })}
                      onReschedule={() => setDialog({ kind: 'reschedule', appointment })}
                      onStatus={() => setDialog({ kind: 'status', appointment })}
                      onCancel={() => setDialog({ kind: 'cancel', appointment })}
                    />
                  </li>
                ))}
              </ul>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Dialogs ---------------- */}

      <Dialog
        open={activeDialog === 'create'}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: 'none' });
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add appointment</DialogTitle>
            <DialogDescription>
              Book a visit for a registered patient with an available doctor.
            </DialogDescription>
          </DialogHeader>
          <AppointmentForm
            mode="create"
            submitLabel="Book appointment"
            submitting={create.isPending}
            submitError={create.isError ? appointmentSubmitErrorMessage(create.error) : null}
            onSubmit={(values) => void handleCreate(values)}
            onCancel={() => setDialog({ kind: 'none' })}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === 'reschedule' && dialogAppointment !== null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: 'none' });
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              {dialogAppointment
                ? `${dialogAppointment.patient?.fullName ?? 'Patient'} · currently ${formatDateTime(
                    dialogAppointment.appointmentDate,
                  )}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {dialogAppointment ? (
            <AppointmentForm
              key={dialogAppointment.id}
              mode="reschedule"
              initialValues={{
                date: splitDateTime(dialogAppointment.appointmentDate).date || todayDateInputValue(),
                time: splitDateTime(dialogAppointment.appointmentDate).time || '09:00',
                duration: dialogAppointment.duration ?? 30,
                reasonForVisit: dialogAppointment.reasonForVisit ?? '',
                notes: dialogAppointment.notes ?? '',
              }}
              submitLabel="Save new time"
              submitting={reschedule.isPending}
              submitError={reschedule.isError ? appointmentSubmitErrorMessage(reschedule.error) : null}
              onSubmit={(values) => void handleReschedule(dialogAppointment, values)}
              onCancel={() => setDialog({ kind: 'none' })}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <DetailsDialog
        appointment={activeDialog === 'details' ? dialogAppointment : null}
        onClose={() => setDialog({ kind: 'none' })}
      />

      <StatusDialog
        appointment={activeDialog === 'status' ? dialogAppointment : null}
        submitting={changeStatus.isPending}
        error={changeStatus.isError ? appointmentSubmitErrorMessage(changeStatus.error) : null}
        onSubmit={(next) => dialogAppointment && void handleStatusChange(dialogAppointment, next)}
        onClose={() => setDialog({ kind: 'none' })}
      />

      <CancelDialog
        appointment={activeDialog === 'cancel' ? dialogAppointment : null}
        submitting={cancel.isPending}
        error={cancel.isError ? appointmentSubmitErrorMessage(cancel.error) : null}
        onSubmit={(reason) => dialogAppointment && void handleCancel(dialogAppointment, reason)}
        onClose={() => setDialog({ kind: 'none' })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  onSort,
  indicator,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  indicator: (key: SortKey) => React.ReactNode;
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead aria-sort={active ? (indicator(sortKey) ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        {indicator(sortKey)}
        <span className="sr-only">Sort by {label}</span>
      </button>
    </TableHead>
  );
}

function RowActions({
  appointment,
  canManage,
  canChangeStatus,
  onView,
  onReschedule,
  onStatus,
  onCancel,
}: {
  appointment: AppointmentRecord;
  canManage: boolean;
  canChangeStatus: boolean;
  onView: () => void;
  onReschedule: () => void;
  onStatus: () => void;
  onCancel: () => void;
}) {
  const transitions = APPOINTMENT_STATUS_TRANSITIONS[appointment.status] ?? [];
  const canReschedule = canManage && (appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED');
  const canCancel = canManage && appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED';

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={onView}>
        View
      </Button>
      {canReschedule ? (
        <Button variant="ghost" size="sm" onClick={onReschedule} aria-label="Reschedule appointment">
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {canChangeStatus && transitions.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={onStatus}>
          Status
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          aria-label="Cancel appointment"
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function AppointmentCard({
  appointment,
  canManage,
  canChangeStatus,
  onView,
  onReschedule,
  onStatus,
  onCancel,
}: {
  appointment: AppointmentRecord;
  canManage: boolean;
  canChangeStatus: boolean;
  onView: () => void;
  onReschedule: () => void;
  onStatus: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{appointment.patient?.fullName ?? 'Unknown patient'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {appointment.patient?.registrationNumber
              ? `Reg. ${appointment.patient.registrationNumber}`
              : 'No registration number'}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-4 w-4" aria-hidden />
          <dt className="sr-only">Date and time</dt>
          <dd>
            {formatDate(appointment.appointmentDate)} at {formatTime(appointment.appointmentDate)}
            {appointment.duration ? ` · ${appointment.duration} min` : ''}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Stethoscope className="h-4 w-4" aria-hidden />
          <dt className="sr-only">Doctor</dt>
          <dd>
            {appointment.doctor?.fullName ?? 'Unknown doctor'}
            {appointment.doctor?.specialization ? ` · ${appointment.doctor.specialization}` : ''}
          </dd>
        </div>
        {appointment.reasonForVisit ? (
          <div className="flex items-start gap-2 text-muted-foreground">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Reason</dt>
            <dd>{appointment.reasonForVisit}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={onView}>
          View
        </Button>
        {canManage && (appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED') ? (
          <Button variant="outline" size="sm" onClick={onReschedule}>
            <Pencil className="h-4 w-4" /> Reschedule
          </Button>
        ) : null}
        {canChangeStatus && (APPOINTMENT_STATUS_TRANSITIONS[appointment.status] ?? []).length > 0 ? (
          <Button variant="outline" size="sm" onClick={onStatus}>
            Status
          </Button>
        ) : null}
        {canManage && appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AppointmentTableSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
      <span className="sr-only">Loading appointments…</span>
    </div>
  );
}

function EmptyState({
  hasFilters,
  canManage,
  onReset,
  onAdd,
}: {
  hasFilters: boolean;
  canManage: boolean;
  onReset: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
      <CalendarClock className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">
          {hasFilters ? 'No appointments match your filters' : 'No appointments scheduled yet'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters
            ? 'Try widening the date range or clearing the filters.'
            : 'Book the first visit to get the schedule started.'}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="outline" onClick={onReset}>
          <Filter className="h-4 w-4" /> Clear filters
        </Button>
      ) : canManage ? (
        <Button onClick={onAdd}>
          <CalendarPlus className="h-4 w-4" /> Add appointment
        </Button>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page + 1} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail and action dialogs
// ---------------------------------------------------------------------------

function DetailsDialog({
  appointment,
  onClose,
}: {
  appointment: AppointmentRecord | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={appointment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment details</DialogTitle>
          <DialogDescription>
            {appointment ? formatDateTime(appointment.appointmentDate) : ''}
          </DialogDescription>
        </DialogHeader>
        {appointment ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Patient" value={appointment.patient?.fullName} />
            <Detail label="Registration number" value={appointment.patient?.registrationNumber ?? undefined} />
            <Detail label="Patient email" value={appointment.patient?.email ?? undefined} />
            <Detail label="Doctor" value={appointment.doctor?.fullName} />
            <Detail label="Specialisation" value={appointment.doctor?.specialization ?? undefined} />
            <Detail label="Duration" value={appointment.duration ? `${appointment.duration} minutes` : undefined} />
            <Detail label="Reason for visit" value={appointment.reasonForVisit ?? undefined} />
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={appointment.status} />
              </dd>
            </div>
            <Detail label="Notes" value={appointment.notes ?? undefined} />
            {appointment.status === 'CANCELLED' ? (
              <>
                <Detail label="Cancelled by" value={appointment.cancelledBy ?? undefined} />
                <Detail label="Cancellation reason" value={appointment.cancellationReason ?? undefined} />
                <Detail label="Cancelled at" value={formatDateTime(appointment.cancellationDate)} />
              </>
            ) : null}
            <Detail label="Booked at" value={formatDateTime(appointment.createdAt)} />
          </dl>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || '—'}</dd>
    </div>
  );
}

function StatusDialog({
  appointment,
  submitting,
  error,
  onSubmit,
  onClose,
}: {
  appointment: AppointmentRecord | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (status: AppointmentStatus) => void;
  onClose: () => void;
}) {
  const [next, setNext] = useState<AppointmentStatus | ''>('');
  const [reason, setReason] = useState('');

  const options = appointment ? APPOINTMENT_STATUS_TRANSITIONS[appointment.status] ?? [] : [];

  return (
    <Dialog
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setNext('');
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.patient?.fullName ?? 'Patient'} is currently ${statusLabel(
                  appointment.status,
                ).toLowerCase()}.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="appointment-next-status">New status</Label>
          <Select
            id="appointment-next-status"
            value={next}
            onChange={(event) => setNext(event.target.value as AppointmentStatus | '')}
          >
            <option value="">-- Choose --</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Only the steps the server allows from the current status are offered.
          </p>
        </div>

        {next === 'CANCELLED' ? (
          <div className="space-y-1.5">
            <Label htmlFor="appointment-cancel-reason">Reason</Label>
            <Input
              id="appointment-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Patient called to cancel"
              maxLength={500}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => next && onSubmit(next)}
            disabled={!next || submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Saving…' : 'Save status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cancellation is destructive and irreversible from this screen, so it is behind a
 * dialog that names the appointment and requires a reason. The reason is not
 * decoration: it is stored on the record and is the only explanation an audit has.
 */
function CancelDialog({
  appointment,
  submitting,
  error,
  onSubmit,
  onClose,
}: {
  appointment: AppointmentRecord | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.patient?.fullName ?? 'The patient'} · ${formatDateTime(
                  appointment.appointmentDate,
                )}. The slot becomes available again to book.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="appointment-cancellation-reason">
            Reason <span className="text-red-500">*</span>
          </Label>
          <Input
            id="appointment-cancellation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Patient rescheduled by phone"
            maxLength={500}
            aria-describedby="appointment-cancellation-reason-help"
            autoFocus
          />
          <p id="appointment-cancellation-reason-help" className="text-xs text-muted-foreground">
            Recorded on the appointment so the cancellation can be explained later.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Keep appointment
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(reason.trim())}
            disabled={reason.trim().length === 0 || submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReceptionAppointmentsPage;