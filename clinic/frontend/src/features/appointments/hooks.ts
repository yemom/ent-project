'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { createAppointment, listAppointments, updateAppointment } from '@/services/api/appointments';

export function useAppointments(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => listAppointments(params)
  });
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: createAppointment
  });
}

export function useUpdateAppointment() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateAppointment(id, payload)
  });
}
