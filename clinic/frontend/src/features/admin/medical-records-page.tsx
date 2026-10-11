'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Lock, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';
import { PERMISSIONS } from '@/features/auth/permissions';
import type { PageResponse } from '@/types/api';

/**
 * Medical records index.
 *
 * <p>Deliberately a *list*, not an editor. Signed clinical records are immutable by
 * design — corrections go through a recorded amendment, never an in-place edit — so
 * this page reads and links to the record rather than offering an edit control that
 * would be refused anyway.
 *
 * <p>Requires `patient:demographics:read`, which the API enforces on the underlying
 * endpoint.
 */

interface MedicalRecordRow {
  id: string;
  patientId?: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  diagnosis?: string | null;
  recordDate?: string | null;
  signedAt?: string | null;
}

export function MedicalRecordsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusType>(null);

  const canReadRecords = useAuthStore((state) => state.hasPermission(PERMISSIONS.DIAGNOSIS_WRITE));

  const { data, isLoading, error } = useQuery({
    queryKey: ['medical-records', { page: 0, size: 100 }],
    queryFn: async () => {
      const response = await apiClient.get<PageResponse<MedicalRecordRow>>('/medical-records', {
        params: { page: 0, size: 100 },
      });
      return response.data;
    },
    staleTime: 30_000,
    // Never fire a request the API would reject: reading records needs a clinical
    // permission, which SUPER_ADMIN deliberately does not hold.
    enabled: canReadRecords,
  });

  // Every hook runs before any conditional return. Bailing out above these would
  // change the hook order between renders and trip rules-of-hooks.
  const rows = useMemo(() => data?.content ?? [], [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.patientName, row.doctorName, row.diagnosis, row.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [query, rows]);

  const signed = rows.filter((row) => row.signedAt).length;

  // Explicit restricted state. Hiding the failure behind a generic error would
  // look like a broken page rather than a deliberate access boundary.
  if (!canReadRecords) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Medical Records"
          description="Clinical records across the hospital. Signed records are immutable."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Restricted
            </CardTitle>
            <CardDescription>This role cannot read clinical records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Medical records, diagnoses and prescriptions are deliberately excluded from the
              Super Admin role: platform administration does not need clinical access, and
              granting it would widen exposure of patient data.
            </p>
            <p>
              Record counts are still available on the overview dashboard without exposing any
              clinical content.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="Clinical records across the hospital. Signed records are immutable."
      />

      <StatusAlert
        status={status ?? (error ? 'error' : null)}
        message={error ? getFriendlyErrorMessage(error, 'Medical records could not be loaded.') : ''}
        onDismiss={() => setStatus(null)}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Records" value={rows.length} loading={isLoading} />
        <Metric label="Signed" value={signed} loading={isLoading} />
        <Metric label="Unsigned" value={rows.length - signed} loading={isLoading} />
      </div>

      <div className="flex min-w-64 items-center gap-3 rounded-2xl border border-input bg-background p-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by patient, doctor or diagnosis..."
          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Records
          </CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : `${filtered.length} record(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? 'No medical records yet.' : 'No records match that search.'}
            </p>
          ) : (
            filtered.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.patientName ?? 'Patient'}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.diagnosis ?? 'No diagnosis recorded'}
                    {row.doctorName ? ` · ${row.doctorName}` : ''}
                    {row.recordDate ? ` · ${new Date(row.recordDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <Badge variant={row.signedAt ? 'success' : 'warning'}>
                  {row.signedAt ? 'Signed' : 'Unsigned'}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="text-3xl">{loading ? '...' : value}</CardTitle>
      </CardHeader>
    </Card>
  );
}