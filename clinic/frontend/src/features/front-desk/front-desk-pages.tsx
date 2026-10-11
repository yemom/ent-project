'use client';

import { useMemo, useState } from 'react';
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogIn,
  Search,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { listPatients } from '@/services/api/users';
import { useQuery } from '@tanstack/react-query';
import {
  frontDeskErrorMessage,
  FRONT_DESK_KEYS,
  useAssignDoctor,
  useAvailableDoctors,
  useCheckInPatient,
  useRegisterPatient,
} from '@/features/front-desk/hooks/use-front-desk';
import type { PatientDemographics } from '@/types/api';

function usePatientLookup() {
  const [query, setQuery] = useState('');

  const patients = useQuery({
    queryKey: ['front-desk', 'patient-search', query],
    queryFn: async () => {
      const response = await listPatients({ size: 25 });
      return (response.content ?? []) as unknown as PatientDemographics[];
    },
    enabled: query.trim().length > 0,
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const list = patients.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return list.filter((patient) =>
      [patient.fullName, patient.email, (patient as any).registrationNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [patients.data, query]);

  return { query, setQuery, filtered, isLoading: patients.isLoading };
}

// ============================================================================
// ReceptionDeskPage — today's front-desk overview.
// ============================================================================
export function ReceptionDeskPage() {
  const checkIn = useCheckInPatient();
  const assign = useAssignDoctor();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDemographics | null>(null);
  const lookup = usePatientLookup();
  const doctors = useAvailableDoctors();

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      setStatus('success');
      setMessage(success);
    } catch (err) {
      setStatus('error');
      setMessage(frontDeskErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Front Desk"
        description="Register patients, check them in, and assign them to the right doctor."
        actionLabel="Register patient"
        actionHref="/reception/register"
      />

      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Manage bookings from the Appointments tab.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="h-4 w-4" /> Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Checked-in patients appear in the queue.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-4 w-4" /> Available doctors
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {doctors.isLoading ? '...' : (doctors.data?.length ?? 0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find a patient</CardTitle>
          <CardDescription>Search by name, email or registration number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-w-64 items-center gap-3 rounded-2xl border border-input bg-background p-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={lookup.query}
              onChange={(event) => lookup.setQuery(event.target.value)}
              placeholder="Start typing to search..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {lookup.isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : lookup.filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lookup.query ? 'No matching patients.' : 'Enter a search term.'}
            </p>
          ) : (
            <div className="space-y-2">
              {lookup.filtered.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatient(patient)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    selectedPatient?.id === patient.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{patient.fullName}</p>
                    <p className="text-sm text-muted-foreground">{patient.email}</p>
                  </div>
                  {patient.checkedIn ? (
                    <Badge variant="success">Checked in</Badge>
                  ) : (
                    <Badge variant="outline">Not checked in</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPatient ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{selectedPatient.fullName}</CardTitle>
            <CardDescription>
              {selectedPatient.registrationNumber ?? 'No registration number'}
              {selectedPatient.assignedDoctorName
                ? ` · Assigned to ${selectedPatient.assignedDoctorName}`
                : ' · Unassigned'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={checkIn.isPending}
                onClick={() =>
                  run(
                    () =>
                      checkIn.mutateAsync({
                        patientId: selectedPatient.id,
                        checkedIn: !selectedPatient.checkedIn,
                      }),
                    selectedPatient.checkedIn ? 'Patient checked out.' : 'Patient checked in.'
                  )
                }
              >
                <LogIn className="h-4 w-4" />
                {selectedPatient.checkedIn ? 'Check out' : 'Check in'}
              </Button>
            </div>

            <AssignDoctorCard
              patient={selectedPatient}
              onAssigned={() =>
                run(
                  () =>
                    assign.mutateAsync({ patientId: selectedPatient.id, doctorId: selectedPatient.id }),
                  'Patient assigned.'
                )
              }
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AssignDoctorCard({
  patient,
  onAssigned,
}: {
  patient: PatientDemographics;
  onAssigned: () => void;
}) {
  const doctors = useAvailableDoctors();

  return (
    <div className="space-y-2 rounded-2xl bg-muted/50 p-4">
      <p className="text-sm font-medium">Assign to a doctor</p>
      {doctors.isLoading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : (doctors.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No doctors are currently available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(doctors.data ?? []).map((doctor) => (
            <Button
              key={doctor.id}
              variant="outline"
              size="sm"
              disabled={patient.assignedDoctorId === doctor.id}
              onClick={onAssigned}
            >
              <Stethoscope className="h-4 w-4" />
              {doctor.fullName}
              {doctor.specialization ? ` · ${doctor.specialization}` : ''}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RegisterPatientPage — demographics only.
// ============================================================================
export function RegisterPatientPage() {
  const register = useRegisterPatient();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    branchId: '',
  });

  const canSubmit = form.fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(form.email);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const created = await register.mutateAsync({
        ...form,
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        phone: form.phone || undefined,
        bloodType: form.bloodType || undefined,
        branchId: form.branchId || undefined,
      });
      setStatus('success');
      setMessage(`Registered ${created.fullName} (${created.registrationNumber ?? 'no number'}).`);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        bloodType: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        branchId: '',
      });
    } catch (err) {
      setStatus('error');
      setMessage(frontDeskErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register Patient"
        description="Demographics only — clinical records are created by clinical staff."
      />

      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />

      <Card>
        <CardHeader>
          <CardTitle>Patient details</CardTitle>
          <CardDescription>The patient receives an account and can claim it with a password reset.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" required>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </Field>
              <Field label="Gender">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Blood type">
                <Input
                  value={form.bloodType}
                  onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                  placeholder="O+"
                />
              </Field>
              <Field label="Emergency contact">
                <Input
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                />
              </Field>
              <Field label="Emergency phone">
                <Input
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                />
              </Field>
              <Field label="Branch">
                <Input
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  placeholder="branch-1"
                />
              </Field>
            </div>
            <Button type="submit" disabled={!canSubmit || register.isPending}>
              <UserPlus className="h-4 w-4" />
              {register.isPending ? 'Registering...' : 'Register patient'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

// ============================================================================
// ReceptionQueuePage — checked-in patients and their assigned doctor.
// ============================================================================
export function ReceptionQueuePage() {
  const checkIn = useCheckInPatient();
  const lookup = usePatientLookup();

  return (
    <div className="space-y-6">
      <PageHeader title="Queue" description="Patients currently checked in at the front desk." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Waiting room
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex min-w-64 items-center gap-3 rounded-2xl border border-input bg-background p-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={lookup.query}
              onChange={(event) => lookup.setQuery(event.target.value)}
              placeholder="Search checked-in patients..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {lookup.filtered.filter((patient) => patient.checkedIn).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is checked in right now.</p>
          ) : (
            lookup.filtered
              .filter((patient) => patient.checkedIn)
              .map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between rounded-2xl bg-muted/50 p-4"
                >
                  <div>
                    <p className="font-medium">{patient.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {patient.assignedDoctorName ?? 'Awaiting doctor assignment'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={checkIn.isPending}
                    onClick={() =>
                      void checkIn.mutateAsync({ patientId: patient.id, checkedIn: false })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Check out
                  </Button>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ReceptionPlaceholderPage — used for routes that reuse an existing page.
// ============================================================================
export function ReceptionPlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Users className="h-5 w-5" />
          This area reuses the existing scheduling screens.
        </CardContent>
      </Card>
    </div>
  );
}

export { FRONT_DESK_KEYS };