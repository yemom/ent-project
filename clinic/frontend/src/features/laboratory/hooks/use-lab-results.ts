'use client';

import { useEffect, useState } from 'react';
import { labResultsService } from '../services/lab-results.service';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { LabResult } from '../types';

export function useLabResult(orderId?: string) {
  const [result, setResult] = useState<LabResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const currentOrderId = orderId;
    if (!currentOrderId) return;
    async function fetch(labOrderId: string) {
      try {
        setIsLoading(true);
        const data = await labResultsService.getByLabOrderId(labOrderId);
        if (!mounted) return;
        setResult(data ?? null);
        setError(null);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Could not load lab result'));
      } finally {
        setIsLoading(false);
      }
    }
    fetch(currentOrderId);
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const submit = async (payload: any) => labResultsService.submit(payload);
  const update = async (id: string, payload: any) => labResultsService.update(id, payload);

  return { result, isLoading, error, submit, update };
}
