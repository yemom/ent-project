'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { frontDeskApi } from '@/services/api/front-desk';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { PatientDemographics, RegisterPatientPayload } from '@/types/api';

export const FRONT_DESK_KEYS = {
  availableDoctors: (departmentId?: string) => ['front-desk', 'doctors', departmentId ?? 'all'] as const,
  myPatients: (params: Record<string, unknown>) => ['front-desk', 'my-patients', params] as const,
  demographics: (patientId: string) => ['front-desk', 'patient', patientId] as const,
};

/** Doctors available for assignment, optionally filtered by department. */
export function useAvailableDoctors(departmentId?: string) {
  return useQuery({
    queryKey: FRONT_DESK_KEYS.availableDoctors(departmentId),
    queryFn: () => frontDeskApi.availableDoctors(departmentId),
    staleTime: 60_000,
  });
}

/** The signed-in doctor's assigned panel. */
export function useMyPatients(params: { page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: FRONT_DESK_KEYS.myPatients(params),
    queryFn: () => frontDeskApi.myPatients(params),
  });
}

export function useRegisterPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPatientPayload) => frontDeskApi.registerPatient(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useCheckInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, checkedIn }: { patientId: string; checkedIn?: boolean }) =>
      frontDeskApi.checkIn(patientId, { checkedIn: checkedIn ?? true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
    },
  });
}

export function useAssignDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      doctorId,
      reason,
      departmentId,
    }: {
      patientId: string;
      doctorId: string;
      reason?: string;
      departmentId?: string;
    }) => frontDeskApi.assignDoctor(patientId, { doctorId, reason, departmentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
    },
  });
}

export function frontDeskErrorMessage(err: unknown): string {
  return getFriendlyErrorMessage(err, 'We could not complete that front-desk action.');
}

export type { PatientDemographics };