import { apiClient } from '@/services/api/client';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { PageResponse, UserRole } from '@/types/api';
import { fetchAllPages } from './page-utils';

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'OFFLINE' | 'INVITED';
  lastLogin?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  medicalHistory?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  active?: boolean;
  available?: boolean;
  specialization?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * The patient directory, as `/patients` actually returns it.
 *
 * <p>Distinct from {@link UserItem}: the endpoint answers with the typed patient
 * shape, which carries `registrationNumber`. The flat `UserItem` shape has no such
 * field, which is why the registration number read as `undefined` on every screen
 * that looked a patient up through this module — including the front desk, whose
 * whole job is identifying patients by the number on their card.
 */
export interface PatientDirectoryItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  registrationNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  active: boolean | null;
}

export async function listUsers(params: Record<string, string | number | undefined> = {}) {
  try {
    const data = await fetchAllPages(async (page, size) => {
      const response = await apiClient.get<PageResponse<UserItem>>('/admin/users', {
        params: { ...params, page, size },
      });
      return response.data;
    });
    data.content = (data.content ?? []).map((user) => ({
      ...user,
      status: user.status ?? (user.active === false ? 'OFFLINE' : 'ACTIVE')
    }));
    return data;
  } catch (error) {
    try {
      return await listStaffDirectory(params);
    } catch {
      throw new Error(getFriendlyErrorMessage(error, 'We could not load users right now. Please try again.'));
    }
  }
}

/**
 * The people directory, for a caller that cannot read `/admin/users`.
 *
 * <p>A hospital administrator holds `staff:manage` but not `user:manage`, so the
 * account directory 403s for them. Rather than fire a request that is guaranteed to
 * be refused and log a console error on every page that shows staff, this asks the
 * two directories the role *can* read. It is the same fallback {@link listUsers}
 * falls back to; exposed so a caller can skip the doomed request entirely.
 */
export async function listStaffDirectory(
  params: Record<string, string | number | undefined> = {},
): Promise<PageResponse<UserItem>> {
  const [doctorsRes, patientsRes] = await Promise.all([listDoctors(params), listPatients(params)]);

  const combinedContent = [
    ...(doctorsRes.content ?? []),
    ...(patientsRes.content ?? []),
  ];

  return {
    ...doctorsRes,
    content: combinedContent,
    totalElements: combinedContent.length,
    totalPages: 1,
  } as PageResponse<UserItem>;
}

/** A page of the patient directory, for pickers that need the registration number. */
export async function listPatientDirectory(
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<PageResponse<PatientDirectoryItem>> {
  const { data } = await apiClient.get<PageResponse<PatientDirectoryItem>>('/patients', { params });
  return data;
}

/** Every page of the patient directory, for a search box that filters as you type. */
export async function searchPatientDirectory(
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<PageResponse<PatientDirectoryItem>> {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<PatientDirectoryItem>>('/patients/search', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function listDoctors(params: Record<string, string | number | boolean | undefined> = {}) {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<UserItem>>('/doctors', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function searchDoctors(params: Record<string, string | number | boolean | undefined> = {}) {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<UserItem>>('/doctors/search', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function listAvailableDoctors(params: Record<string, string | number | boolean | undefined> = {}) {
  return searchDoctors({ available: true, active: true, size: 100, ...params });
}

export async function listPatients(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<UserItem>>('/patients', { params });
  
  // Keep admin accounts out of patient-facing lists.
  if (data.content) {
    data.content = data.content.filter(u => u.role !== 'ADMIN');
    data.totalElements = data.content.length;
  }
  
  return data;
}

export async function searchPatients(params: Record<string, string | number | undefined> = {}) {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<UserItem>>('/patients/search', {
      params: { ...params, page, size },
    });
    if (data.content) {
      data.content = data.content.filter(u => u.role !== 'ADMIN');
      data.totalElements = data.content.length;
    }
    return data;
  });
}

export async function getPatient(id: string) {
  const { data } = await apiClient.get<UserItem>(`/patients/${id}`);
  return data;
}

export async function updatePatient(id: string, payload: Partial<UserItem>) {
  const { data } = await apiClient.put<UserItem>(`/patients/${id}`, payload);
  return data;
}