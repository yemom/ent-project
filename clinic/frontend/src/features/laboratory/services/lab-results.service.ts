import apiClient from '@/lib/api-client';
import type { LabResult, SubmitLabResultDto } from '../types';

export const labResultsService = {
  submit: (payload: SubmitLabResultDto) => apiClient.post<LabResult>('/api/lab-results', payload).then((r) => r.data),
  getByLabOrderId: (orderId: string) => apiClient.get<LabResult>(`/api/lab-results/order/${orderId}`).then((r) => r.data),
  getByOrder: (orderId: string) => apiClient.get<LabResult>(`/api/lab-results/order/${orderId}`).then((r) => r.data),
  update: (id: string, payload: Partial<SubmitLabResultDto>) => apiClient.patch<LabResult>(`/api/lab-results/${id}`, payload).then((r) => r.data)
};
