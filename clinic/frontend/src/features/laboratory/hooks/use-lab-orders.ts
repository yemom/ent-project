'use client';

import { useCallback, useEffect, useState } from 'react';
import { labOrdersService } from '../services/lab-orders.service';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { LabOrder } from '../types';

export function useLabOrders(filters?: Record<string, any>) {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await labOrdersService.list(filters);
      // Backend returns a Page<LabOrderResponse> with a `content` array
      const items = Array.isArray(data) ? data : (data as any)?.content ?? [];
      setOrders(items);
      setError(null);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not load lab orders'));
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setIsLoading(true);
        const data = await labOrdersService.list(filters);
        if (!mounted) return;
        const items = Array.isArray(data) ? data : (data as any)?.content ?? [];
        setOrders(items);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(getFriendlyErrorMessage(err, 'Could not load lab orders'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [JSON.stringify(filters)]);

  const create = async (payload: any) => {
    const result = await labOrdersService.create(payload);
    await fetch();
    return result;
  };

  const updateStatus = async (id: string, status: string) => {
    return labOrdersService.updateStatus(id, status);
  };

  return { orders, isLoading, error, create, updateStatus, refetch: fetch };
}
