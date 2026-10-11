'use client';

import { UserAccountsPage } from '@/features/admin/user-accounts-page';
import type { UserRole } from '@/types/api';

/**
 * Staff directory for a single role.
 *
 * <p>Now a thin wrapper over {@link UserAccountsPage}. It used to carry its own
 * table, fetch every account and filter in the browser — which meant paging was
 * wrong, the deactivate action bypassed the audited status endpoint, and this copy
 * had to be kept in step with every other one. Delegating means the Nurses page and
 * the Cashiers page are the same code as the main directory, differing only in which
 * role is locked.
 *
 * <p>The `icon` prop is accepted and ignored so the existing route files keep
 * working unchanged.
 */
export function StaffDirectoryPage({
  role,
  title,
  description,
}: {
  role: UserRole;
  title: string;
  description: string;
  /** Unused; retained for compatibility with the existing route files. */
  icon?: string;
}) {
  return <UserAccountsPage lockedRole={role} title={title} description={description} />;
}
