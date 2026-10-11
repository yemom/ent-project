'use client';

import { useMemo, useState } from 'react';
import { Pencil, ShieldAlert, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select } from '@/components/ui/select';
import {
  useAccountList,
  useActiveSuperAdminCount,
  useChangeAccountRole,
  useChangeAccountStatus,
  useDeleteAccount,
  accountGuard,
} from '@/features/admin/use-user-accounts';
import { useAuthStore } from '@/store/auth-store';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { ManagedUser } from '@/services/api/admin';
import { AccountActionDialog } from '@/features/admin/account-action-dialog';
import { ASSIGNABLE_ROLES } from '@/features/admin/user-account-form';
import type { UserRole } from '@/types/api';

const ALL_ROLES = 'ALL';
const ALL_STATUS = 'ALL';

/**
 * The account directory: one table for every role.
 *
 * <p>The Doctors, Nurses, Cashiers, Pharmacists, Receptionists, Laboratory and
 * Patients screens are all this component with `lockedRole` set. Rendering them from
 * one place is the point — five hand-maintained copies of the same table would drift
 * apart within a week, and the drift would show up as "deactivate works on the
 * nurses page but not the cashiers page".
 *
 * <p>Filtering, searching and paging all happen on the server. Filtering a
 * pre-fetched page in the browser would report a short page and hide matches that
 * sit on the next one.
 */
export function UserAccountsTable({
  lockedRole,
  onEdit,
}: {
  /** When set the table shows one role only and hides the role filter. */
  lockedRole?: UserRole;
  onEdit: (user: ManagedUser) => void;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const superAdminCount = useActiveSuperAdminCount();

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(lockedRole ?? ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUS);
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      role: lockedRole ?? (roleFilter === ALL_ROLES ? undefined : (roleFilter as UserRole)),
      active: statusFilter === ALL_STATUS ? undefined : statusFilter === 'ACTIVE',
      q: query.trim() || undefined,
      page,
      size: 20,
    }),
    [lockedRole, page, query, roleFilter, statusFilter]
  );

  const { data, isLoading, isFetching, error, refetch } = useAccountList(filters);

  const changeStatus = useChangeAccountStatus();
  const changeRole = useChangeAccountRole();
  const removeAccount = useDeleteAccount();

  const [pendingAction, setPendingAction] = useState<{ user: ManagedUser; mode: 'deactivate' | 'delete' } | null>(
    null
  );

  const rows = data?.content ?? [];

  const totalPages = data?.totalPages ?? 0;

  // An unknown count must not disable the safety controls: the server refuses these
  // actions regardless, so guessing "blocked" would be worse than guessing "allowed".
  const guardFor = (user: ManagedUser) =>
    accountGuard(user, currentUserId, superAdminCount ?? Number.POSITIVE_INFINITY);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="Search name, email or phone..."
          className="min-w-64 flex-1"
          aria-label="Search accounts"
        />

        {!lockedRole ? (
          <Select
            value={roleFilter}
            aria-label="Filter by role"
            className="w-48"
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value={ALL_ROLES}>All roles</option>
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}

        <Select
          value={statusFilter}
          aria-label="Filter by status"
          className="w-44"
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value={ALL_STATUS}>Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Deactivated</option>
        </Select>
      </div>

      {error ? (
        <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {getFriendlyErrorMessage(error, 'This list could not be loaded.')}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {query || roleFilter !== ALL_ROLES || statusFilter !== ALL_STATUS
            ? 'No accounts match these filters.'
            : 'No accounts yet. Create one to get started.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                {!lockedRole ? <TableHead>Role</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const guard = guardFor(user);
                const busy =
                  changeStatus.isPending ||
                  changeRole.isPending ||
                  removeAccount.isPending;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.fullName}
                      {guard.isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      ) : null}
                      {user.phone ? (
                        <span className="block text-xs text-muted-foreground">{user.phone}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    {!lockedRole ? (
                      <TableCell>
                        {/* A select rather than static text: a role change is a real,
                            audited action, not a label. Locked for the cases the
                            server would refuse anyway. */}
                        <Select
                          value={user.role}
                          disabled={!guard.canChangeRole || busy}
                          aria-label={`Role for ${user.fullName}`}
                          className="h-8 w-44"
                          onChange={(event) =>
                            changeRole.mutate({ id: user.id, role: event.target.value as UserRole })
                          }
                        >
                          {ASSIGNABLE_ROLES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Badge variant={user.active ? 'success' : 'outline'}>
                        {user.active ? 'Active' : 'Deactivated'}
                      </Badge>
                      {user.mustChangePassword && user.active ? (
                        <Badge variant="warning" className="ml-2">
                          Must reset password
                        </Badge>
                      ) : null}
                      {!user.active && user.deactivationReason ? (
                        <span
                          className="mt-1 block max-w-48 truncate text-xs text-muted-foreground"
                          title={user.deactivationReason}
                        >
                          {user.deactivationReason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(user)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {user.fullName}</span>
                        </Button>

                        {guard.canDeactivate ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              user.active
                                ? setPendingAction({ user, mode: 'deactivate' })
                                : changeStatus.mutate({ id: user.id, active: true })
                            }
                          >
                            {user.active ? (
                              <>
                                <UserX className="h-4 w-4" />
                                <span className="sr-only">Deactivate {user.fullName}</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4" />
                                <span className="sr-only">Reactivate {user.fullName}</span>
                              </>
                            )}
                          </Button>
                        ) : null}

                        {guard.canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setPendingAction({ user, mode: 'delete' })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete {user.fullName}</span>
                          </Button>
                        ) : (
                          <ShieldAlert
                            className="h-4 w-4 text-muted-foreground/60"
                            aria-label="Protected account"
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {data?.totalElements ?? 0} account(s)
            {isFetching ? ' · updating…' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <AccountActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          mode={pendingAction.mode}
          fullName={pendingAction.user.fullName}
          busy={changeStatus.isPending || removeAccount.isPending}
          onConfirm={(reason) => {
            const { user, mode } = pendingAction;
            const done = () => setPendingAction(null);

            if (mode === 'delete') {
              removeAccount.mutate(user.id, { onSuccess: done });
            } else {
              // The reason is not optional here: the server refuses a deactivation
              // without one, so the dialog exists to collect it before submitting.
              changeStatus.mutate(
                { id: user.id, active: false, reason },
                { onSuccess: done }
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}
