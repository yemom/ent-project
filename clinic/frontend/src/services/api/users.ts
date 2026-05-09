import { apiClient } from '@/services/api/client';
import type { PageResponse, UserRole } from '@/types/api';

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'OFFLINE' | 'INVITED';
  lastLogin?: string;
}

export async function listUsers(params: Record<string, string | number | undefined> = {}) {
  // Backend doesn't have a /users endpoint. Combine /doctors and /patients.
  try {
    const [doctorsRes, patientsRes] = await Promise.all([
      listDoctors(params),
      listPatients(params)
    ]);
    
    // Combine content
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
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

export async function listDoctors(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<UserItem>>('/doctors', { params });
  return data;
}

export async function listPatients(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<PageResponse<UserItem>>('/patients', { params });
  
  // Ensure we never treat ADMIN users as patients
  if (data.content) {
    data.content = data.content.filter(u => u.role !== 'ADMIN');
    data.totalElements = data.content.length;
  }
  
  return data;
}
