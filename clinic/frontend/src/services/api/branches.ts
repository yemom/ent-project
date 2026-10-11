import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  type?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BranchPayload = {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  type?: string;
  active?: boolean;
  notes?: string;
};

export async function listBranches(params?: { page?: number; size?: number }): Promise<PageResponse<Branch>> {
  const { data } = await apiClient.get<PageResponse<Branch>>('/branches', { params: { page: 0, size: 50, ...params } });
  return data;
}

export async function searchBranches(params: { q?: string; page?: number; size?: number }): Promise<PageResponse<Branch>> {
  const { data } = await apiClient.get<PageResponse<Branch>>('/branches/search', { params: { page: 0, size: 50, ...params } });
  return data;
}

export async function getBranch(id: string): Promise<Branch> {
  const { data } = await apiClient.get<Branch>(`/branches/${id}`);
  return data;
}

export async function createBranch(payload: BranchPayload): Promise<Branch> {
  const { data } = await apiClient.post<Branch>('/branches', payload);
  return data;
}

export async function updateBranch(id: string, payload: Partial<BranchPayload>): Promise<Branch> {
  const { data } = await apiClient.put<Branch>(`/branches/${id}`, payload);
  return data;
}

export async function deleteBranch(id: string): Promise<void> {
  await apiClient.delete(`/branches/${id}`);
}
