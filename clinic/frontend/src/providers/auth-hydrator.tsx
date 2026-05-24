'use client';

import { useEffect } from 'react';
import { tokenStorage } from '@/lib/token-storage';
import { useAuthStore } from '@/store/auth-store';
import type { AuthUser } from '@/types/api';

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.role === 'string'
  );
}

export function AuthHydrator() {
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const accessToken = tokenStorage.getAccessToken();
    const user = tokenStorage.getUser<unknown>();
    const refreshToken = tokenStorage.getRefreshToken();

    if (accessToken && isAuthUser(user)) {
      const current = useAuthStore.getState();
      if (!current.accessToken || !current.user) {
        setSession({ accessToken, user, refreshToken: refreshToken ?? undefined });
      }
    }

    setHydrated(true);
  }, [setHydrated, setSession]);

  return null;
}