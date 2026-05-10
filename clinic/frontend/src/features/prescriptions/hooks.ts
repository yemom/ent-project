'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { createPrescription, listPrescriptions } from '@/features/prescriptions';

export function usePrescriptions(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['prescriptions', params],
    queryFn: () => listPrescriptions(params)
  });
}

export function useCreatePrescription() {
  return useMutation({
    mutationFn: createPrescription
  });
}
