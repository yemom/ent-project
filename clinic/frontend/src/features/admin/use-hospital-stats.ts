'use client';

import { useQuery } from '@tanstack/react-query';
import { STATS_KEY, fetchHospitalStats } from '@/services/api/stats';
import { useAuthStore } from '@/store/auth-store';

/**
 * Hospital-wide aggregates.
 *
 * <p>Disabled unless the caller holds `report:read`, so a doctor or cashier
 * never fires a request that would 403. Every number comes from the database.
 */
export function useHospitalStats() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRead = hasPermission('report:read');

  return useQuery({
    queryKey: STATS_KEY,
    queryFn: fetchHospitalStats,
    enabled: canRead,
    staleTime: 30_000,
  });
}