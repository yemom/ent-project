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
      const [doctorsRes, patientsRes] = await Promise.all([listDoctors(params), listPatients(params)]);

      const combinedContent = [
        ...(doctorsRes.content || []),
        ...(patientsRes.content || [])
      ];

      return {
        ...doctorsRes,
        content: combinedContent,
        totalElements: combinedContent.length,
        totalPages: 1
      } as PageResponse<UserItem>;
    } catch {
      throw new Error(getFriendlyErrorMessage(error, 'We could not load users right now. Please try again.'));
    }
  }
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
