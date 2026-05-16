import apiClient from '@/lib/api-client';
import type { CreateLabOrderDto, LabOrder } from '../types';

export const labOrdersService = {
  create: (payload: CreateLabOrderDto) => apiClient.post<LabOrder>('/api/lab-orders', payload).then((r) => r.data),
  list: (params?: Record<string, any>) => apiClient.get<LabOrder[]>('/api/lab-orders', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<LabOrder>(`/api/lab-orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) => apiClient.patch<LabOrder>(`/api/lab-orders/${id}/status`, { status }).then((r) => r.data)
};
