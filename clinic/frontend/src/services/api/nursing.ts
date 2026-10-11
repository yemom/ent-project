import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

/**
 * Nursing observations: vitals, nursing notes and medication administration.
 *
 * <p>A nurse may only record against a patient assigned to them — the API
 * rejects the write otherwise, so the UI does not need to guess.
 */

export type ObservationKind = 'VITALS' | 'NURSING_NOTE' | 'MEDICATION_ADMINISTRATION';

export interface NurseObservation {
  id: string;
  patientId: string;
  patientName: string;
  recordedById: string;
  recordedByName?: string | null;
  kind: ObservationKind;
  bloodPressure?: string | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weightKg?: number | null;
  medication?: string | null;
  dose?: string | null;
  notes?: string | null;
  observedAt: string;
}

export interface NurseObservationPayload {
  patientId: string;
  kind: ObservationKind;
  bloodPressure?: string;
  heartRate?: number;
  temperatureC?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  medication?: string;
  dose?: string;
  notes?: string;
}

export const NURSING_KEYS = {
  observations: (patientId?: string, kind?: string) =>
    ['nursing', 'observations', patientId ?? 'all', kind ?? 'all'] as const,
};

export async function listObservations(
  params: { patientId?: string; kind?: string; page?: number; size?: number } = {}
) {
  const { data } = await apiClient.get<PageResponse<NurseObservation>>('/nursing/observations', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function recordObservation(payload: NurseObservationPayload): Promise<NurseObservation> {
  const { data } = await apiClient.post<NurseObservation>('/nursing/observations', payload);
  return data;
}

export async function deleteObservation(id: string): Promise<void> {
  await apiClient.delete(`/nursing/observations/${id}`);
}