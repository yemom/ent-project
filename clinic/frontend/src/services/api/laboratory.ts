import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

export interface Laboratory {
  id: string;
  name: string;
  location: string;
  phone?: string;
  email?: string;
  status: string;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  equipment?: string;
  capacity?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  doctorName: string;
  laboratoryId: string;
  laboratoryName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  maxPatients?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Laboratory API functions
export async function listLaboratories(params?: { size?: number; page?: number; sort?: string }) {
  const { data } = await apiClient.get<PageResponse<Laboratory>>('/laboratories', { params });
  return data;
}

export async function getLaboratory(id: string) {
  const { data } = await apiClient.get<Laboratory>(`/laboratories/${id}`);
  return data;
}

export async function createLaboratory(laboratory: Partial<Laboratory>) {
  const { data } = await apiClient.post<Laboratory>('/laboratories', laboratory);
  return data;
}

export async function updateLaboratory(id: string, laboratory: Partial<Laboratory>) {
  const { data } = await apiClient.put<Laboratory>(`/laboratories/${id}`, laboratory);
  return data;
}

export async function deleteLaboratory(id: string) {
  await apiClient.delete(`/laboratories/${id}`);
}

export async function searchLaboratories(params?: { name?: string; status?: string; size?: number; page?: number }) {
  const { data } = await apiClient.get<PageResponse<Laboratory>>('/laboratories/search', { params });
  return data;
}

// Doctor Availability API functions
export async function listDoctorAvailability(params?: { size?: number; page?: number; sort?: string }) {
  const { data } = await apiClient.get<PageResponse<DoctorAvailability>>('/doctor-availability', { params });
  return data;
}

export async function getDoctorAvailability(id: string) {
  const { data } = await apiClient.get<DoctorAvailability>(`/doctor-availability/${id}`);
  return data;
}

export async function createDoctorAvailability(availability: {
  doctorId: string;
  laboratoryId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  maxPatients?: number;
  notes?: string;
}) {
  const { data } = await apiClient.post<DoctorAvailability>('/doctor-availability', availability);
  return data;
}

export async function updateDoctorAvailability(id: string, availability: Partial<DoctorAvailability>) {
  const { data } = await apiClient.put<DoctorAvailability>(`/doctor-availability/${id}`, availability);
  return data;
}

export async function deleteDoctorAvailability(id: string) {
  await apiClient.delete(`/doctor-availability/${id}`);
}

export async function getDoctorAvailabilityByDoctor(doctorId: string) {
  const { data } = await apiClient.get<DoctorAvailability[]>(`/doctor-availability/doctor/${doctorId}`);
  return data;
}

export async function getDoctorAvailabilityByLaboratory(laboratoryId: string) {
  const { data } = await apiClient.get<DoctorAvailability[]>(`/doctor-availability/laboratory/${laboratoryId}`);
  return data;
}

export async function getDoctorAvailabilityByDay(dayOfWeek: string) {
  const { data } = await apiClient.get<DoctorAvailability[]>(`/doctor-availability/day/${dayOfWeek}`);
  return data;
}
