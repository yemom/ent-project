import { apiClient } from '@/services/api/client';
import type { UserRole } from '@/types/api';

export interface DoctorCreateRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  specialization: string;
  licenseNumber: string;
  yearsOfExperience?: number;
  qualifications?: string;
  /** Backend expects BigDecimal — must be a number, not a string */
  consultationFee?: number;
  bio?: string;
}

export interface PatientCreateRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  /** ISO date string e.g. "1990-05-20" */
  dateOfBirth?: string;
  /** Must match backend Gender enum: MALE | FEMALE | OTHER */
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  medicalHistory?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface InviteUserRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
}

export async function createDoctor(payload: DoctorCreateRequest) {
  const { data } = await apiClient.post('/doctors', payload);
  return data;
}

export async function createPatient(payload: PatientCreateRequest) {
  const { data } = await apiClient.post('/patients', payload);
  return data;
}

/**
 * Creates a non-doctor/patient user (PHARMACIST, LABORATORY, ADMIN).
 * Uses the admin-protected endpoint POST /admin/users.
 */
export async function inviteUser(payload: InviteUserRequest) {
  const { data } = await apiClient.post('/admin/users', payload);
  return data;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export async function updateUser(id: string, payload: UpdateUserRequest) {
  const { data } = await apiClient.put(`/admin/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string) {
  await apiClient.delete(`/admin/users/${id}`);
}

export async function updatePatient(id: string, payload: Partial<PatientCreateRequest>) {
  const { data } = await apiClient.put(`/patients/${id}`, payload);
  return data;
}

export async function deletePatient(id: string) {
  const { data } = await apiClient.delete(`/patients/${id}`);
  return data;
}
