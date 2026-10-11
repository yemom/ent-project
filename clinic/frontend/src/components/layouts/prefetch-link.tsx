'use client';

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { listAppointments } from '@/services/api/appointments';
import { listDoctors, listPatients, listUsers } from '@/services/api/users';
import { useAuthStore } from '@/store/auth-store';
import type { UserRole } from '@/types/api';

/**
 * Query keys shared between prefetch and the pages themselves.
 * Keep in sync with the keys used inside each feature page.
 */
export const prefetchKeys = {
  users: (params?: Record<string, string | number | undefined>) => ['users', params ?? {}] as const,
  doctors: (params?: Record<string, string | number | undefined>) => ['doctors', params ?? {}] as const,
  patients: (params?: Record<string, string | number | undefined>) => ['patients', params ?? {}] as const,
  appointments: (params?: Record<string, string | number | undefined>) => ['appointments', params ?? {}] as const,
};

/** Lightweight page-level data each role's dashboard shows first. */
const dashboardPrefetches: Record<string, Array<() => Promise<unknown>>> = {
  ADMIN: [
    () => listUsers({ size: 1 }),
    () => listDoctors({ size: 8 }),
    () => listPatients({ size: 1 }),
    () => listAppointments({ size: 8 }),
  ],
  HOSPITAL_ADMIN: [() => listDoctors({ size: 8 }), () => listUsers({ size: 1 })],
  DOCTOR: [() => listAppointments({ size: 8 })],
  NURSE: [() => listPatients({ size: 8 })],
  RECEPTIONIST: [() => listAppointments({ size: 8 }), () => listDoctors({ size: 8 })],
  LAB_TECHNICIAN: [],
  PHARMACIST: [() => listAppointments({ size: 1 })],
  CASHIER: [() => listAppointments({ size: 8 })],
  PATIENT: [() => listAppointments({ size: 8 })],
};

/**
 * Warms the TanStack cache for the queries a role's dashboard needs, so the
 * dashboard paints from cache instead of waiting on a cold round trip.
 * Best-effort: failures are ignored because the page re-queries on its own.
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);

  return useCallback(() => {
    if (!role) return;
    const loaders = dashboardPrefetches[role];
    if (!loaders?.length) return;
    loaders.forEach((loader) => {
      void loader().catch(() => {
        /* prefetch is best-effort */
      });
    });
    void queryClient;
  }, [queryClient, role]);
}

type PrefetchLinkProps = React.ComponentProps<typeof NextLink> & {
  children?: ReactNode;
};

/**
 * `<Link>` that also triggers the route prefetch on hover, so the RSC payload
 * is already in flight by the time the click lands.
 */
export function PrefetchLink({ onMouseEnter, children, ...props }: PrefetchLinkProps) {
  const router = useRouter();

  const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(event);
    router.prefetch(props.href as never);
  };

  return (
    <NextLink {...props} onMouseEnter={handleMouseEnter}>
      {children}
    </NextLink>
  );
}

export default PrefetchLink;