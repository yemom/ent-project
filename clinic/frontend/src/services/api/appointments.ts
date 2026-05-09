import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

export interface AppointmentItem {
  id: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  status: 'CONFIRMED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason: string;
}

export async function listAppointments(params: Record<string, string | number | undefined> = {}) {
  // Use /search endpoint if we have filter params, otherwise use base /appointments
  const endpoint = Object.keys(params).length > 0 ? '/appointments/search' : '/appointments';
  const { data } = await apiClient.get<PageResponse<AppointmentItem>>(endpoint, { params });
  return data;
}

export async function searchAppointments(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<AppointmentItem>>('/appointments/search', { params });
  return data;
}

export async function createAppointment(payload: Record<string, unknown>) {
  const { data } = await apiClient.post<AppointmentItem>('/appointments', payload);
  return data;
}

export async function updateAppointment(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.put<AppointmentItem>(`/appointments/${id}`, payload);
  return data;
}
