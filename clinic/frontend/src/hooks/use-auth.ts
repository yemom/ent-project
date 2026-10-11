'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { login, logout, register, getMe } from '@/services/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { ROUTES } from '@/lib/constants';
import { ROLE_HOME, permissionsForRole } from '@/features/auth/permissions';
import type { UserRole } from '@/types/api';

/**
 * Keeps the stored profile (and its permission list) in sync with the server.
 * Runs once per authenticated session; the API stays the source of truth.
 */
export function useCurrentUser() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
}

export function useLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
      const destination = (data?.user?.role && ROLE_HOME[data.user.role]) ? ROLE_HOME[data.user.role] : ROUTES.login;
      // router.replace ensures the login screen is replaced in history and immediately loads the target role dashboard
      router.replace(destination);
    }
  });
}

export function useRegister() {
  const router = useRouter();
  return useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
      const destination = (data?.user?.role && ROLE_HOME[data.user.role]) ? ROLE_HOME[data.user.role] : ROUTES.login;
      router.replace(destination);
    }
  });
}

export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      useAuthStore.getState().clearSession();
      router.push(ROUTES.login);
    }
  });
}

export function useHasRole(roles: UserRole[]) {
  return useAuthStore((state) => state.hasRole(roles));
}

/**
 * True when the signed-in role holds `permission`.
 *
 * Prefers the permission list the server returned with the session, so the UI
 * matches the API exactly; falls back to the local matrix when a session was
 * restored from storage before `/auth/me` was fetched.
 */
export function useHasPermission(permission: string) {
  const serverPermissions = useAuthStore((state) => state.user?.permissions);
  const role = useAuthStore((state) => state.user?.role);

  return useMemo(() => {
    if (serverPermissions?.length) {
      return serverPermissions.includes(permission);
    }
    return permissionsForRole(role).includes(permission as never);
  }, [permission, role, serverPermissions]);
}
