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
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
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
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);

export function AuthHydrator() {
  return null;
}
