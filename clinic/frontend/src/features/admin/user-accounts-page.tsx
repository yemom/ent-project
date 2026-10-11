'use client';

import { useCallback, useState } from 'react';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { UserAccountsTable } from '@/features/admin/user-accounts-table';
import { UserAccountForm } from '@/features/admin/user-account-form';
import { useAccount } from '@/features/admin/use-user-accounts';
import { useAuthStore } from '@/store/auth-store';
import { PERMISSIONS } from '@/features/auth/permissions';
import type { ManagedUser } from '@/services/api/admin';
import type { UserRole } from '@/types/api';

/**
 * Super Admin account management.
 *
 * <p>One screen covers every role. The per-role routes (Doctors, Nurses, Cashiers…)
 * render this same component with the role locked, so there is a single table, a
 * single form and a single set of safety rules in the codebase rather than one copy
 * per role that quietly diverges.
 */
export function UserAccountsPage({
  lockedRole,
  title,
  description,
}: {
  lockedRole?: UserRole;
  title: string;
  description: string;
}) {
  const canManage = useAuthStore((state) => state.hasPermission(PERMISSIONS.USER_MANAGE));

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const closeCreate = useCallback(() => setCreating(false), []);
  const closeEdit = useCallback(() => setEditingId(null), []);

  // The profile lives on the detail endpoint; the list rows deliberately omit it so
  // a 20-row page does not drag every biography through the wire.
  const { data: editing } = useAccount(editingId);

  const startEdit = useCallback((user: ManagedUser) => setEditingId(user.id), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actionLabel={canManage ? 'Create account' : undefined}
        onAction={canManage ? () => setCreating(true) : undefined}
      />

      <UserAccountsTable lockedRole={lockedRole} onEdit={startEdit} />

      {creating ? (
        <Dialog open onOpenChange={(open) => (open ? null : closeCreate())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" /> Create account
              </DialogTitle>
              <DialogDescription>
                Fields change with the role you pick. If you leave the password blank a
                strong one is generated and shown once — it is never stored in readable
                form and cannot be retrieved later.
              </DialogDescription>
            </DialogHeader>
            <UserAccountForm
              defaultRole={lockedRole}
              onDone={closeCreate}
              onCancel={closeCreate}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {editingId ? (
        <Dialog open onOpenChange={(open) => (open ? null : closeEdit())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit {editing?.fullName ?? 'account'}</DialogTitle>
              <DialogDescription>
                Role, activation and deletion are separate audited actions and are not
                changed from here.
              </DialogDescription>
            </DialogHeader>
            {editing ? (
              <UserAccountForm user={editing} onDone={closeEdit} onCancel={closeEdit} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading account details…</p>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
