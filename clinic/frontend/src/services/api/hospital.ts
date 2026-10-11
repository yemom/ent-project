import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

/**
 * Departments, wards, rooms and admissions.
 *
 * <p>Reads need only a valid session; writes carry `department:manage`,
 * `ward:manage`, `room:manage` and `admission:write`, which the API enforces.
 */

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  headDoctorId?: string | null;
  active: boolean;
  createdAt: string;
}

export interface Ward {
  id: string;
  name: string;
  code: string;
  floor?: string | null;
  capacity: number;
  active: boolean;
  departmentId: string;
  departmentName: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  roomType: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  wardId: string;
  wardName: string;
  departmentName: string;
  createdAt: string;
}

export interface Admission {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string | null;
  doctorName?: string | null;
  wardId?: string | null;
  wardName?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  status: 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED';
  diagnosis?: string | null;
  notes?: string | null;
  admittedAt: string;
  dischargedAt?: string | null;
}

export interface DepartmentPayload {
  name: string;
  code: string;
  description?: string;
  headDoctorId?: string;
  active?: boolean;
}

export interface WardPayload {
  departmentId: string;
  name: string;
  code: string;
  floor?: string;
  capacity?: number;
  active?: boolean;
}

export interface RoomPayload {
  wardId: string;
  name: string;
  roomType?: string;
  capacity?: number;
  status?: Room['status'];
}

export interface AdmissionPayload {
  patientId: string;
  doctorId?: string;
  wardId?: string;
  roomId?: string;
  diagnosis?: string;
  notes?: string;
}

export const HOSPITAL_KEYS = {
  departments: ['hospital', 'departments'] as const,
  wards: (departmentId?: string) => ['hospital', 'wards', departmentId ?? 'all'] as const,
  rooms: (wardId?: string) => ['hospital', 'rooms', wardId ?? 'all'] as const,
  admissions: (status?: string) => ['hospital', 'admissions', status ?? 'all'] as const,
};

export async function listDepartments(): Promise<Department[]> {
  const { data } = await apiClient.get<Department[]>('/hospital/departments');
  return data;
}

export async function createDepartment(payload: DepartmentPayload): Promise<Department> {
  const { data } = await apiClient.post<Department>('/hospital/departments', payload);
  return data;
}

export async function updateDepartment(id: string, payload: DepartmentPayload): Promise<Department> {
  const { data } = await apiClient.put<Department>(`/hospital/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiClient.delete(`/hospital/departments/${id}`);
}

export async function listWards(params: { departmentId?: string; page?: number; size?: number } = {}) {
  const { data } = await apiClient.get<PageResponse<Ward>>('/hospital/wards', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function createWard(payload: WardPayload): Promise<Ward> {
  const { data } = await apiClient.post<Ward>('/hospital/wards', payload);
  return data;
}

export async function updateWard(id: string, payload: WardPayload): Promise<Ward> {
  const { data } = await apiClient.put<Ward>(`/hospital/wards/${id}`, payload);
  return data;
}

export async function deleteWard(id: string): Promise<void> {
  await apiClient.delete(`/hospital/wards/${id}`);
}

export async function listRooms(params: { wardId?: string; page?: number; size?: number } = {}) {
  const { data } = await apiClient.get<PageResponse<Room>>('/hospital/rooms', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function createRoom(payload: RoomPayload): Promise<Room> {
  const { data } = await apiClient.post<Room>('/hospital/rooms', payload);
  return data;
}

export async function updateRoom(id: string, payload: RoomPayload): Promise<Room> {
  const { data } = await apiClient.put<Room>(`/hospital/rooms/${id}`, payload);
  return data;
}

export async function deleteRoom(id: string): Promise<void> {
  await apiClient.delete(`/hospital/rooms/${id}`);
}

export async function listAdmissions(params: { status?: string; page?: number; size?: number } = {}) {
  const { data } = await apiClient.get<PageResponse<Admission>>('/hospital/admissions', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

/** Beds board: everyone currently admitted. */
export async function listOpenAdmissions(): Promise<Admission[]> {
  const { data } = await apiClient.get<Admission[]>('/hospital/admissions/open');
  return data;
}

export async function admitPatient(payload: AdmissionPayload): Promise<Admission> {
  const { data } = await apiClient.post<Admission>('/hospital/admissions', payload);
  return data;
}

export async function dischargePatient(id: string): Promise<Admission> {
  const { data } = await apiClient.post<Admission>(`/hospital/admissions/${id}/discharge`);
  return data;
}