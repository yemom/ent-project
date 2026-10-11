'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, AuthUser, UserRole } from '@/types/api';
import { tokenStorage } from '@/lib/token-storage';
import { permissionsForRole } from '@/features/auth/permissions';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  isAuthenticated: boolean;
  setSession: (session: AuthTokens & { user: AuthUser }) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,
      isAuthenticated: false,
      setSession: ({ accessToken, refreshToken, user }) => {
        tokenStorage.setSession(accessToken, user, refreshToken);
        set({ user, accessToken, refreshToken: refreshToken ?? null, isAuthenticated: Boolean(user && accessToken) });
      },
      setUser: (user) => set((state) => ({ user, isAuthenticated: Boolean(user && state.accessToken) })),
      clearSession: () => {
        tokenStorage.clear();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      setHydrated: (value) => set({ isHydrated: value }),
      hasRole: (roles) => {
        const role = get().user?.role;
        return Boolean(role && roles.includes(role));
      },
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        // The server-provided list is authoritative when present.
        if (user.permissions?.length) return user.permissions.includes(permission);
        // Fallback for a session restored from storage without permissions.
        return (permissionsForRole(user.role) as readonly string[]).includes(permission);
      }
    }),
    {
      name: 'clinic-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // `isAuthenticated` is derived here rather than persisted, so it always
          // agrees with the token and profile that were just restored. Recomputing
          // it in one place means no consumer has to know it was not persisted.
          const validSession = Boolean(state.user && state.accessToken);

          if (!validSession) {
            state.clearSession();
          } else {
            tokenStorage.setSession(state.accessToken!, state.user!, state.refreshToken ?? undefined);
            useAuthStore.setState({ isAuthenticated: true });
          }

          state.setHydrated(true);
        }
      }
    }
  )
);