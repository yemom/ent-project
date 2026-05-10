import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

export interface MedicalRecordItem {
  id: string;
  patientName: string;
  doctorName: string;
  visitDate?: string;
  recordDate?: string;
  diagnosis: string;
  prescription?: string;
  treatment?: string;
  notes?: string;
  status: 'DRAFT' | 'SIGNED' | 'ARCHIVED';
  patient?: { fullName: string };
  doctor?: { fullName: string };
  createdAt?: string;
  medicalRecordType?: string;
}

export async function listMedicalRecords(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<MedicalRecordItem>>('/medical-records', { params });
  return data;
}

export async function searchMedicalRecords(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<MedicalRecordItem>>('/medical-records/search', { params });
  return data;
}

export async function createMedicalRecord(payload: Record<string, unknown>) {
  const { data } = await apiClient.post<MedicalRecordItem>('/medical-records', payload);
  return data;
}

export async function updateMedicalRecord(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.put<MedicalRecordItem>(`/medical-records/${id}`, payload);
  return data;
}

export async function deleteMedicalRecord(id: string) {
  await apiClient.delete(`/medical-records/${id}`);
}
