'use client';

import { useEffect, useState } from 'react';
import { labOrdersService } from '../services/lab-orders.service';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { LabOrder } from '../types';

export function useLabOrders(filters?: Record<string, any>) {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      try {
        setIsLoading(true);
        const data = await labOrdersService.list(filters);
        if (!mounted) return;
        setOrders(data ?? []);
        setError(null);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Could not load lab orders'));
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [JSON.stringify(filters)]);

  const create = async (payload: any) => {
    return labOrdersService.create(payload);
  };

  const updateStatus = async (id: string, status: string) => {
    return labOrdersService.updateStatus(id, status);
  };

  return { orders, isLoading, error, create, updateStatus };
}
