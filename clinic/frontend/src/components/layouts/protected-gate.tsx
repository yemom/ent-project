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
  if (role === 'LABORATORY') return ROUTES.laboratoryRoot;
  return ROUTES.adminDashboard;
}

export function ProtectedGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const requiredArea = resolveArea(pathname);
  const isAreaAuthorized = !requiredArea || requiredArea === role;

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !role || !accessToken) {
      clearSession();
      router.replace(ROUTES.login);
      return;
    }

    if (!isAreaAuthorized) {
      router.replace(dashboardForRole(role));
    }
  }, [accessToken, clearSession, isAreaAuthorized, isAuthenticated, isHydrated, pathname, role, router]);

  if (!isHydrated || !isAuthenticated || !role || !accessToken || !isAreaAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    );
  }

  return <>{children}</>;
}