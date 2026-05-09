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
  consultationFee?: string;
  bio?: string;
}

export interface PatientCreateRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
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

export async function inviteUser(payload: InviteUserRequest) {
  const { data } = await apiClient.post('/auth/register', payload);
  return data;
}

export async function updatePatient(id: string, payload: Partial<PatientCreateRequest>) {
  const { data } = await apiClient.put(`/patients/${id}`, payload);
  return data;
}

export async function deletePatient(id: string) {
  const { data } = await apiClient.delete(`/patients/${id}`);
  return data;
}
