'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  changeAccountRole,
  changeAccountStatus,
  createAccount,
  deleteAccount,
  fetchAccount,
  searchAccounts,
  updateAccount,
  type AccountSearchFilters,
  type CreateAccountRequest,
  type ManagedUser,
  type UpdateAccountRequest,
} from '@/services/api/admin';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { UserRole } from '@/types/api';

/**
 * Query keys for the account directory.
 *
 * <p>Centralised so that invalidating the list after a mutation cannot drift from
 * the key the list was fetched under — the usual cause of "the row updated but the
 * table still shows the old value".
 */
export const accountKeys = {
  /** Every filter combination shares the `accounts` root so one call clears all. */
  all: ['accounts'] as const,
  list: (filters: AccountSearchFilters) => ['accounts', 'list', filters] as const,
  detail: (id: string) => ['accounts', 'detail', id] as const,
};

/** The filtered, paginated account directory. */
export function useAccountList(filters: AccountSearchFilters) {
  return useQuery({
    queryKey: accountKeys.list(filters),
    queryFn: () => searchAccounts(filters),
    // Keeps the previous page visible while the next one loads, so the table does
    // not collapse to a skeleton on every keystroke of the search box.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** One account with its role-specific profile. */
export function useAccount(id: string | null) {
  return useQuery({
    queryKey: accountKeys.detail(id ?? ''),
    queryFn: () => fetchAccount(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * How many active Super Admins exist.
 *
 * <p>Needed by the safety guard: "you may not remove the last one" is only
 * enforceable if the UI knows the current total. `size: 1` because the count comes
 * back in `totalElements` — the rows themselves are never read.
 *
 * <p>Zero while loading is deliberately treated as "unknown → allow" by callers, so
 * a slow query never leaves the buttons permanently disabled.
 */
export function useActiveSuperAdminCount() {
  const { data } = useQuery({
    queryKey: accountKeys.list({ role: 'SUPER_ADMIN', active: true, page: 0, size: 1 }),
    queryFn: () => searchAccounts({ role: 'SUPER_ADMIN', active: true, page: 0, size: 1 }),
    staleTime: 30_000,
  });
  return data?.totalElements;
}

/**
 * What the UI is not allowed to offer, and why.
 *
 * <p>The server refuses all of these regardless — this only stops the buttons from
 * appearing. Deriving them here rather than hard-coding means a second Super Admin
 * automatically unlocks the controls that are safe for them.
 */
export interface AccountGuard {
  /** You cannot delete, deactivate or demote yourself. */
  isSelf: boolean;
  /** Removing the last active Super Admin would leave nobody able to administer. */
  isLastSuperAdmin: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
  canChangeRole: boolean;
}

export function accountGuard(
  user: Pick<ManagedUser, 'id' | 'role' | 'active'>,
  currentUserId: string | undefined,
  activeSuperAdminCount: number
): AccountGuard {
  const isSelf = Boolean(currentUserId) && user.id === currentUserId;

  // Counted from the live population rather than "is this the only admin row": if
  // another Super Admin is already inactive, removing this one still leaves zero.
  const superAdminsAfterRemoval = user.role === 'SUPER_ADMIN' && user.active
    ? activeSuperAdminCount - 1
    : activeSuperAdminCount;

  const isLastSuperAdmin = user.role === 'SUPER_ADMIN' && superAdminsAfterRemoval <= 0;

  return {
    isSelf,
    isLastSuperAdmin,
    canDeactivate: !isSelf && !isLastSuperAdmin,
    canDelete: !isSelf && !isLastSuperAdmin,
    canChangeRole: !isSelf && !(isLastSuperAdmin && user.role === 'SUPER_ADMIN'),
  };
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAccountRequest) => createAccount(payload),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast.success(
        result.generatedPassword
          ? 'Account created. Copy the temporary password now — it is not shown again.'
          : `${result.user.fullName} was created.`
      );
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, 'That account could not be created.'));
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountRequest }) =>
      updateAccount(id, payload),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.detail(updated.id) });
      toast.success(`${updated.fullName} was updated.`);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, 'Those changes could not be saved.'));
    },
  });
}

/**
 * Activate / deactivate.
 *
 * <p>Optimistic with a rollback: the badge flips immediately and reverts if the
 * server refuses. Deactivating an account is a click away and the row usually has to
 * be trusted at a glance, so waiting for a round trip to show the truth is worse
 * than briefly showing a wrong one that corrects itself.
 */
export function useChangeAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active, reason }: { id: string; active: boolean; reason?: string }) =>
      changeAccountStatus(id, active, reason),

    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: accountKeys.all });

      const previous = queryClient.getQueriesData({ queryKey: accountKeys.all });

      queryClient.setQueriesData({ queryKey: accountKeys.all }, (old: unknown) => {
        const page = old as { content?: ManagedUser[] } | undefined;
        if (!page?.content) return old;
        return {
          ...page,
          content: page.content.map((u) => (u.id === id ? { ...u, active } : u)),
        };
      });

      return { previous };
    },

    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error(getFriendlyErrorMessage(error, 'That account could not be updated.'));
    },

    onSuccess: (updated) => {
      toast.success(
        `${updated.fullName} is now ${updated.active ? 'active' : 'deactivated'}.`
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useChangeAccountRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role, reason }: { id: string; role: UserRole; reason?: string }) =>
      changeAccountRole(id, role, reason),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      toast.success(`${updated.fullName} is now ${updated.role.replace(/_/g, ' ').toLowerCase()}.`);
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, 'That role could not be changed.'));
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.removeQueries({ queryKey: accountKeys.detail(id) });
      toast.success('Account deleted. It is hidden from the directory and can no longer sign in.');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, 'That account could not be deleted.'));
    },
  });
}
