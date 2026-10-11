'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { listAuditLogs, type AuditLogEntry } from '@/services/api/admin';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

/**
 * Audit trail.
 *
 * <p>Append-only on the server — a Postgres trigger blocks UPDATE and DELETE — so
 * this is a read-only viewer. There is deliberately no edit or delete control.
 */

/**
 * Every action the server can record, mirrored from the backend `AuditAction` enum.
 *
 * <p>Declared here rather than filtering over what has already been loaded: the
 * dropdown has to offer actions the current page of results happens not to contain,
 * or an administrator could only ever filter by what is already visible. Adding an
 * action to the enum without adding it here makes it unfilterable, which is why this
 * list is explicit.
 */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  RECORD_VIEWED: 'RECORD_VIEWED',
  RECORD_CREATED: 'RECORD_CREATED',
  RECORD_AMENDED: 'RECORD_AMENDED',
  PATIENT_ASSIGNED: 'PATIENT_ASSIGNED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  ROLE_CHANGE_REQUESTED: 'ROLE_CHANGE_REQUESTED',
  ROLE_CHANGE_APPROVED: 'ROLE_CHANGE_APPROVED',
  REFUND_ISSUED: 'REFUND_ISSUED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  BREAK_GLASS_ACCESS: 'BREAK_GLASS_ACCESS',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
} as const;

const ACTION_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  RECORD_CREATED: 'success',
  RECORD_AMENDED: 'warning',
  RECORD_VIEWED: 'outline',
  PATIENT_ASSIGNED: 'outline',
  REFUND_REQUESTED: 'warning',
  REFUND_APPROVED: 'success',
  REFUND_ISSUED: 'success',
  ROLE_CHANGED: 'warning',
  LOGIN_SUCCESS: 'outline',
  LOGIN_FAILED: 'destructive',
  // Account lifecycle: creation and reactivation are benign, the three that remove
  // or restrict access are what an administrator reviews.
  USER_CREATED: 'success',
  USER_ACTIVATED: 'success',
  USER_UPDATED: 'outline',
  USER_DELETED: 'destructive',
  USER_DEACTIVATED: 'warning',
  USER_PASSWORD_RESET: 'warning',
  BREAK_GLASS_ACCESS: 'destructive',
};

export const AUDIT_LOG_KEY = ['admin', 'audit-logs'] as const;

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [status, setStatus] = useState<StatusType>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...AUDIT_LOG_KEY, action],
    queryFn: () => listAuditLogs(action ? { action } : {}),
    staleTime: 30_000,
  });

  const entries = data?.content ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every privileged action, append-only. Entries cannot be edited or removed."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Entries
          </CardTitle>
          <CardDescription>
            {data?.totalElements ?? 0} recorded action(s). Database triggers reject any update or delete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusAlert
            status={status ?? (error ? 'error' : null)}
            message={error ? getFriendlyErrorMessage(error, 'The audit log could not be loaded.') : ''}
            onDismiss={() => setStatus(null)}
          />

          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm md:w-72"
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {Object.values(AUDIT_ACTIONS).map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries match this filter.</p>
          ) : (
            entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-muted/50 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {entry.actorEmail ?? entry.actorId ?? 'System'}
          {entry.actorRole ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{entry.actorRole}</span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.targetType ?? 'record'}
          {entry.targetId ? ` ${entry.targetId}` : ''}
          {entry.reason ? ` — ${entry.reason}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={ACTION_VARIANT[entry.action] ?? 'outline'}>
          {entry.action.replace(/_/g, ' ')}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}