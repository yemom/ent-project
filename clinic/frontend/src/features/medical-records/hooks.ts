'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { createMedicalRecord, listMedicalRecords } from '@/services/api/medical-records';

export function useMedicalRecords(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['medical-records', params],
    queryFn: () => listMedicalRecords(params)
  });
}

export function useCreateMedicalRecord() {
  return useMutation({
    mutationFn: createMedicalRecord
  });
}
