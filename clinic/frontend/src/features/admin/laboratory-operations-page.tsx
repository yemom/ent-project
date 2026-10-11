'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Beaker, FlaskConical, Search, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { StaffDirectoryTable } from '@/features/admin/staff-directory-table';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';
import type { LabOrder, LabResult } from '@/features/laboratory/types';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

/**
 * Laboratory operations.
 *
 * <p>Three things an administrator needs to see at once: who can run tests, what
 * has been requested, and what has come back â€” with critical results surfaced
 * first, because those are the ones that need a clinician.
 *
 * <p>Results are read-only here. Recording and validating a result belongs to the
 * laboratory technician who performed the test, so the API rejects those writes for
 * this role.
 */
export function LaboratoryOperationsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusType>(null);

  const orders = useQuery({
    queryKey: ['lab', 'orders'],
    queryFn: () => labOrdersService.list({ size: 100 }),
    staleTime: 30_000,
  });

  const results = useQuery({
    queryKey: ['lab', 'results'],
    queryFn: () => labResultsService.getAll({ size: 100 }),
    staleTime: 30_000,
  });

  const orders_ = useMemo(() => orders.data?.content ?? [], [orders.data]);
  const results_ = useMemo(() => results.data?.content ?? [], [results.data]);

  const critical = useMemo(() => results_.filter((result) => result.critical), [results_]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders_;
    return orders_.filter((order) =>
      [order.id, order.patientName, order.doctorName, order.tests?.join(' ') ?? '']
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [query, orders_]);

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results_;
    return results_.filter((result) =>
      [result.id, result.findings, result.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [query, results_]);

  const pendingOrders = orders_.filter((order) => order.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory"
        description="Technicians, test requests and results. Critical results first."
      />

      <StatusAlert
        status={status ?? (orders.error || results.error ? 'error' : null)}
        message={
          orders.error || results.error
            ? getFriendlyErrorMessage(orders.error ?? results.error, 'Laboratory data could not be loaded.')
            : ''
        }
        onDismiss={() => setStatus(null)}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Test requests" value={orders_.length} icon={FlaskConical} loading={orders.isLoading} />
        <Metric label="Pending" value={pendingOrders} icon={Beaker} loading={orders.isLoading} />
        <Metric label="Results" value={results_.length} icon={Beaker} loading={results.isLoading} />
        <Metric
          label="Critical"
          value={critical.length}
          icon={AlertTriangle}
          loading={results.isLoading}
          alert={critical.length > 0}
        />
      </div>

      <div className="flex min-w-64 items-center gap-3 rounded-2xl border border-input bg-background p-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search orders and results..."
          className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Critical results
          </CardTitle>
          <CardDescription>
            Flagged by the technician as needing urgent clinician attention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.isLoading ? (
            <Skeleton className="h-14 w-full rounded-2xl" />
          ) : critical.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical results recorded.</p>
          ) : (
            critical.map((result) => <ResultRow key={result.id} result={result} critical />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Test requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test requests recorded.</p>
          ) : (
            filteredOrders.slice(0, 50).map((order) => <OrderRow key={order.id} order={order} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-4 w-4" /> Results
          </CardTitle>
          <CardDescription>
            Read-only here â€” recording and validation belong to the laboratory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : filteredResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results recorded.</p>
          ) : (
            filteredResults.slice(0, 50).map((result) => <ResultRow key={result.id} result={result} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Laboratory technicians
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StaffDirectoryTable role="LAB_TECHNICIAN" emptyText="No laboratory technicians yet." />
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({ order }: { order: LabOrder }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {order.patientName ?? 'Patient'}
          {order.doctorName ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{order.doctorName}</span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {(order.tests ?? []).join(', ') || 'No tests listed'}
          {order.urgency ? ` Â· ${order.urgency}` : ''}
        </p>
      </div>
      <Badge variant={order.status === 'pending' ? 'warning' : 'outline'}>{order.status}</Badge>
    </div>
  );
}

/**
 * Renders findings, which the API returns either as free text or as a per-test
 * map. Showing the map's values keeps the actual measurements visible instead of
 * printing "[object Object]".
 */
function describeFindings(findings: LabResult['findings']): string {
  if (!findings) return 'Result';
  if (typeof findings === 'string') return findings;
  const entries = Object.entries(findings);
  if (entries.length === 0) return 'Result';
  return entries.map(([test, value]) => `${test}: ${value}`).join(', ');
}

function ResultRow({ result, critical }: { result: LabResult; critical?: boolean }) {
  const summary = describeFindings(result.findings);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${
        critical ? 'border border-destructive/50 bg-destructive/5' : 'bg-muted/50'
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium">
          {summary.length > 90 ? `${summary.slice(0, 90)}...` : summary}
          {result.critical ? (
            <Badge variant="destructive" className="ml-2">
              Critical
            </Badge>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {result.submittedAt
            ? new Date(result.submittedAt).toLocaleString()
            : 'Not yet submitted'}
        </p>
      </div>
      <Badge variant={result.status === 'final' ? 'success' : 'outline'}>{result.status}</Badge>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
  alert,
}: {
  label: string;
  value: number;
  icon: typeof Beaker;
  loading?: boolean;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive/50' : undefined}>
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