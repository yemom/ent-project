'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { login, logout, register, getMe } from '@/services/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { ROUTES } from '@/lib/constants';
import type { UserRole } from '@/types/api';

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: isAuthenticated
  });
}

export function useLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
      const target = data.user.role === 'DOCTOR' ? ROUTES.doctorDashboard : data.user.role === 'PATIENT' ? ROUTES.patientDashboard : data.user.role === 'PHARMACIST' ? ROUTES.pharmacistDashboard : ROUTES.adminDashboard;
      router.push(target);
    }
  });
}

export function useRegister() {
  const router = useRouter();
  return useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
      const target = data.user.role === 'DOCTOR' ? ROUTES.doctorDashboard : data.user.role === 'PATIENT' ? ROUTES.patientDashboard : data.user.role === 'PHARMACIST' ? ROUTES.pharmacistDashboard : ROUTES.adminDashboard;
      router.push(target);
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
