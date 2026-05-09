'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/store/auth-store';

function resolveArea(pathname: string) {
  if (pathname.startsWith('/admin')) return 'ADMIN';
  if (pathname.startsWith('/doctor')) return 'DOCTOR';
  if (pathname.startsWith('/patient')) return 'PATIENT';
  if (pathname.startsWith('/pharmacist')) return 'PHARMACIST';
  return null;
}

function dashboardForRole(role?: string | null) {
  if (role === 'DOCTOR') return ROUTES.doctorDashboard;
  if (role === 'PATIENT') return ROUTES.patientDashboard;
  if (role === 'PHARMACIST') return ROUTES.pharmacistDashboard;
  return ROUTES.adminDashboard;
}

export function ProtectedGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace(ROUTES.login);
      return;
    }

    const area = resolveArea(pathname);
    if (area && role && area !== role) {
      router.replace(dashboardForRole(role));
    }
  }, [isAuthenticated, isHydrated, pathname, role, router]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}