'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';

export interface NavBadgeCounts {
  unreadNotifications?: number;
  pendingApprovals?: number;
  pendingRefunds?: number;
  pendingOrders?: number;
  pendingPrescriptions?: number;
  lowStock?: number;
  expiringBatches?: number;
  [key: string]: number | undefined;
}

export function useNavBadges(): NavBadgeCounts {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);

  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ['nav-badges', 'unread-notifications'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<number>('/notifications/unread-count');
        return data || 0;
      } catch {
        return 0;
      }
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: adminBadges = {} } = useQuery({
    queryKey: ['nav-badges', 'admin', role],
    queryFn: async () => {
      const counts: NavBadgeCounts = {};
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        try {
          const { data } = await apiClient.get<any>('/admin/role-requests', {
            params: { status: 'PENDING', size: 1 },
          });
          counts.pendingApprovals = data?.totalElements || 0;
        } catch {
          counts.pendingApprovals = 0;
        }
      }
      if (role === 'CASHIER' || role === 'SUPER_ADMIN') {
        try {
          const { data } = await apiClient.get<any>('/billing/refunds', {
            params: { status: 'REQUESTED', size: 1 },
          });
          counts.pendingRefunds = data?.totalElements || 0;
        } catch {
          counts.pendingRefunds = 0;
        }
      }
      return counts;
    },
    enabled: isAuthenticated && (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'CASHIER'),
    staleTime: 45_000,
  });

  return {
    unreadNotifications,
    ...adminBadges,
  };
}
