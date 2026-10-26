'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InpatientNurseForecastView } from "@/features/ai/role-forecast-views";
import {
  Sparkles,
  Activity,
  ClipboardList,
  HeartPulse,
  PillBottle,
  Search,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { useMyPatients } from '@/features/front-desk/hooks/use-front-desk';
import {
  NURSING_KEYS,
  deleteObservation,
  listObservations,
  recordObservation,
  type ObservationKind,
} from '@/services/api/nursing';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { PatientDemographics } from '@/types/api';

/**
 * Nurse workspace.
 *
 * <p>Writes go to the nursing observations endpoint, which is what `vital:write`
 * and `medication:administer` actually authorise. There is deliberately no
 * diagnosis or prescription field here — a nurse cannot prescribe, so the UI does
 * not offer the illusion that they can.
 */

type Mode = 'vitals' | 'medication';

export function NurseDashboardPage() {
  const { data, isLoading } = useMyPatients({ size: 25 });
  const patients = useMemo(() => data?.content ?? [], [data]);
  const { data: recent } = useRecentObservations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nursing Dashboard"
        description="Assigned patients, vitals and medication administration."
      />

      {/* ── AI Inpatient & Care Forecast ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
            <Sparkles className="h-4 w-4 text-purple-500" /> Inpatient &amp; Nursing AI Forecast
          </h3>
          <span className="text-xs text-muted-foreground">Ward Intelligence</span>
        </div>
        <InpatientNurseForecastView />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Assigned patients" value={patients.length} loading={isLoading} icon={HeartPulse} />
        <Metric label="Observations recorded" value={recent?.totalElements ?? 0} loading={isLoading} icon={Activity} />
        <Metric
          label="Admitted to a bed"
          value={patients.filter((patient) => patient.checkedIn).length}
          loading={isLoading}
          icon={PillBottle}
        />
      </div>

      <ObservationHistory />
    </div>
  );
}

/**
 * The nurse's own panel: the patients currently allocated to them.
 *
 * <p>Distinct from {@link NurseVitalsPage}, which renders the same patients but framed
 * as a form to record vitals against. This page answers "who is on my list?", which
 * is what the sidebar link promises.
 */
export function NursePatientsPage() {
  const { data, isLoading } = useMyPatients({ size: 25 });
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Patients"
        description="The patients currently allocated to you by the front desk."
      />
      <PatientPanel patients={data?.content ?? []} isLoading={isLoading} mode="vitals" />
    </div>
  );
}

export function NurseVitalsPage() {
  const { data, isLoading } = useMyPatients({ size: 25 });
  return (
    <div className="space-y-6">
      <PageHeader title="Vitals" description="Record observations for your assigned patients." />
      <PatientPanel patients={data?.content ?? []} isLoading={isLoading} mode="vitals" />
      <ObservationHistory />
    </div>
  );
}

export function NurseMedicationsPage() {
  const { data, isLoading } = useMyPatients({ size: 25 });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Medication Administration"
        description="Record administration of prescribed medication. Nurses cannot prescribe."
      />
      <PatientPanel patients={data?.content ?? []} isLoading={isLoading} mode="medication" />
      <ObservationHistory kinds={['MEDICATION_ADMINISTRATION']} />
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl">
          {loading ? '...' : value}
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

/** Recent entries on the caller's own panel. */
function useRecentObservations() {
  return useQuery({
    queryKey: NURSING_KEYS.observations(),
    queryFn: () => listObservations({ size: 10 }),
    staleTime: 30_000,
  });
}

function ObservationHistory({
  kinds = ['VITALS', 'NURSING_NOTE', 'MEDICATION_ADMINISTRATION'],
}: {
  kinds?: ObservationKind[];
}) {
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: NURSING_KEYS.observations(undefined, kinds.join(',')),
    queryFn: () => listObservations({ size: 25 }),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: deleteObservation,
    onSuccess: () => {
      setStatus('success');
      setMessage('Observation removed.');
      void queryClient.invalidateQueries({ queryKey: ['nursing'] });
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That observation could not be removed.'));
    },
  });

  const observations = useMemo(() => {
    const rows = data?.content ?? [];
    return kinds.length === 3 ? rows : rows.filter((row) => kinds.includes(row.kind));
  }, [data, kinds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Observation history
        </CardTitle>
        <CardDescription>Scoped to the patients allocated to you by the front desk.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </>
        ) : observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          observations.map((observation) => (
            <div
              key={observation.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-muted/50 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {observation.patientName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {new Date(observation.observedAt).toLocaleString()}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">{describe(observation)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{observation.kind.replace(/_/g, ' ')}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(observation.id)}
                  title="Only your own entries can be removed"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function describe(observation: {
  kind: string;
  bloodPressure?: string | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weightKg?: number | null;
  medication?: string | null;
  dose?: string | null;
  notes?: string | null;
}) {
  if (observation.kind === 'MEDICATION_ADMINISTRATION') {
    return [observation.medication, observation.dose].filter(Boolean).join(' · ') || 'Medication administered';
  }

  const parts = [
    observation.bloodPressure ? `BP ${observation.bloodPressure}` : null,
    observation.heartRate != null ? `HR ${observation.heartRate}` : null,
    observation.temperatureC != null ? `Temp ${observation.temperatureC}°C` : null,
    observation.respiratoryRate != null ? `RR ${observation.respiratoryRate}` : null,
    observation.oxygenSaturation != null ? `SpO₂ ${observation.oxygenSaturation}%` : null,
    observation.weightKg != null ? `${observation.weightKg} kg` : null,
    observation.notes,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Nursing note';
}

/** Patient list with an inline form for the one write the nurse role has. */
function PatientPanel({
  patients,
  isLoading,
  mode,
}: {
  patients: PatientDemographics[];
  isLoading: boolean;
  mode: Mode;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PatientDemographics | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) =>
      [patient.fullName, patient.registrationNumber ?? '']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [patients, query]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> My patients
          </CardTitle>
          <CardDescription>Scoped to your assignment by the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-w-64 items-center gap-3 rounded-2xl border border-input bg-background p-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your patients..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patients are assigned to you yet. Ask the front desk to allocate one.
            </p>
          ) : (
            filtered.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.registrationNumber ?? 'No registration number'}
                    {patient.checkedIn ? ' · Checked in' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={patient.checkedIn ? 'success' : 'outline'}>
                    {patient.checkedIn ? 'Present' : 'Away'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(patient)}
                  >
                    {mode === 'vitals' ? 'Record vitals' : 'Record administration'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selected ? (
        <ObservationForm
          patient={selected}
          kind={mode === 'vitals' ? 'VITALS' : 'MEDICATION_ADMINISTRATION'}
          onDone={() => setSelected(null)}
          onCancel={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function ObservationForm({
  patient,
  kind,
  onDone,
  onCancel,
}: {
  patient: PatientDemographics;
  kind: ObservationKind;
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weightKg: '',
    medication: '',
    dose: '',
    notes: '',
  });

  const isMedication = kind === 'MEDICATION_ADMINISTRATION';

  const save = useMutation({
    mutationFn: () =>
      recordObservation({
        patientId: patient.id,
        kind,
        bloodPressure: form.bloodPressure.trim() || undefined,
        heartRate: form.heartRate ? Number(form.heartRate) : undefined,
        temperatureC: form.temperature ? Number(form.temperature) : undefined,
        respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
        oxygenSaturation: form.oxygenSaturation ? Number(form.oxygenSaturation) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        medication: form.medication.trim() || undefined,
        dose: form.dose.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (saved) => {
      setStatus('success');
      setMessage(`${describe(saved)} recorded for ${patient.fullName}.`);
      void queryClient.invalidateQueries({ queryKey: ['nursing'] });
      void queryClient.invalidateQueries({ queryKey: ['front-desk', 'patients'] });
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That observation could not be saved.'));
    },
  });

  const hasVitals =
    form.bloodPressure.trim().length > 0 ||
    form.heartRate.length > 0 ||
    form.temperature.length > 0 ||
    form.respiratoryRate.length > 0 ||
    form.oxygenSaturation.length > 0 ||
    form.weightKg.length > 0;
  const hasContent = isMedication
    ? form.medication.trim().length > 0
    : hasVitals || form.notes.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isMedication ? 'Medication administration' : 'Record vitals'} — {patient.fullName}
        </CardTitle>
        <CardDescription>
          {isMedication
            ? 'Record that prescribed medication was given. You cannot prescribe.'
            : 'Record the observations you took. Leave a field blank if you did not measure it.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={5000} />

        {isMedication ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.medication}
              onChange={(event) => setForm({ ...form, medication: event.target.value })}
              placeholder="Medication (required)"
            />
            <Input
              value={form.dose}
              onChange={(event) => setForm({ ...form, dose: event.target.value })}
              placeholder="Dose (e.g. 500mg IV)"
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={form.bloodPressure}
              onChange={(event) => setForm({ ...form, bloodPressure: event.target.value })}
              placeholder="Blood pressure (120/80)"
            />
            <Input
              type="number"
              value={form.heartRate}
              onChange={(event) => setForm({ ...form, heartRate: event.target.value })}
              placeholder="Heart rate (bpm)"
            />
            <Input
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={(event) => setForm({ ...form, temperature: event.target.value })}
              placeholder="Temperature (°C)"
            />
            <Input
              type="number"
              value={form.respiratoryRate}
              onChange={(event) => setForm({ ...form, respiratoryRate: event.target.value })}
              placeholder="Respiratory rate"
            />
            <Input
              type="number"
              step="0.01"
              value={form.oxygenSaturation}
              onChange={(event) => setForm({ ...form, oxygenSaturation: event.target.value })}
              placeholder="SpO₂ (%)"
            />
            <Input
              type="number"
              step="0.01"
              value={form.weightKg}
              onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
              placeholder="Weight (kg)"
            />
          </div>
        )}

        <textarea
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Notes (optional)"
          rows={3}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm"
        />

        <div className="flex gap-2">
          <Button disabled={!hasContent || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save observation'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}