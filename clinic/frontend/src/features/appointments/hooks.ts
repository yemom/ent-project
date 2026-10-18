'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,
  type AppointmentCreatePayload,
  type AppointmentRecord,
  type AppointmentSearchParams,
  type AppointmentStatus,
  type AppointmentUpdatePayload,
} from '@/services/api/appointments';

/** One cache entry for every appointment query, so a write can invalidate them all. */
export const APPOINTMENT_KEYS = {
  all: ['appointments'] as const,
  list: (params: AppointmentSearchParams) => ['appointments', 'list', params] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
};

export function useAppointments(params: AppointmentSearchParams = {}) {
  return useQuery({
    queryKey: APPOINTMENT_KEYS.list(params),
    queryFn: () => listAppointments(params),
    // Keeps the previous page on screen while the next one loads, so filtering does
    // not collapse the table into a skeleton on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useAppointment(id: string | null) {
  return useQuery({
    queryKey: APPOINTMENT_KEYS.detail(id ?? ''),
    queryFn: () => getAppointment(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Every mutation here invalidates the whole `appointments` namespace.
 *
 * <p>Filters, the unfiltered list and the prefetch the app shell runs on login are
 * separate cache entries; refreshing only the one the caller happened to be looking
 * at leaves the sidebar badge and the next filter click showing stale rows.
 */
function useAppointmentMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.all });
    },
  });
}

export function useCreateAppointment() {
  return useAppointmentMutation((payload: AppointmentCreatePayload) => createAppointment(payload));
}

export function useUpdateAppointment() {
  return useAppointmentMutation(({ id, payload }: { id: string; payload: AppointmentUpdatePayload }) =>
    updateAppointment(id, payload),
  );
}

export function useChangeAppointmentStatus() {
  return useAppointmentMutation(
    ({ id, status, reason }: { id: string; status: AppointmentStatus; reason?: string }) =>
      changeAppointmentStatus(id, status, reason),
  );
}

export function useCancelAppointment() {
  return useAppointmentMutation(({ id, reason }: { id: string; reason: string }) =>
    cancelAppointment(id, reason),
  );
}

export type { AppointmentRecord, AppointmentStatus };