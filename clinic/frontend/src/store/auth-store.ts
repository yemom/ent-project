'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, AuthUser, UserRole } from '@/types/api';
import { tokenStorage } from '@/lib/token-storage';

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
          state.setHydrated(true);
          const validSession = Boolean(state.user && state.accessToken);
          if (!validSession) {
            state.clearSession();
          } else {
            tokenStorage.setSession(state.accessToken!, state.user!, state.refreshToken ?? undefined);
            if (!state.isAuthenticated) {
              useAuthStore.setState((current) => ({ ...current, isAuthenticated: true }));
            }
          }
        }
      }
    }
  )
);
