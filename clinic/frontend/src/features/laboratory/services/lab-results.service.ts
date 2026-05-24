import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';
import type { LabResult, SubmitLabResultDto } from '../types';

// The lab-results backend controller is at /api/lab-results (no /v1 in path)
const LAB_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/api\/v1$/, '');

function getAuthHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const labResultsService = {
  submit: async (payload: SubmitLabResultDto): Promise<LabResult> => {
    const res = await axios.post<LabResult>(`${LAB_BASE}/api/lab-results`, { ...payload, status: String(payload.status).toUpperCase() }, {
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  },
  getByLabOrderId: async (orderId: string): Promise<LabResult | null> => {
    try {
      const res = await axios.get<LabResult>(`${LAB_BASE}/api/lab-results/order/${orderId}`, {
        headers: { ...getAuthHeader() },
        withCredentials: true
      });
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
  getByOrder: async (orderId: string): Promise<LabResult | null> => {
    try {
      const res = await axios.get<LabResult>(`${LAB_BASE}/api/lab-results/order/${orderId}`, {
        headers: { ...getAuthHeader() },
        withCredentials: true
      });
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
  getAll: async (params?: Record<string, any>): Promise<{ content: LabResult[]; totalElements: number }> => {
    const res = await axios.get(`${LAB_BASE}/api/lab-results`, {
      params,
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  },
  update: async (id: string, payload: Partial<SubmitLabResultDto>): Promise<LabResult> => {
    const res = await axios.patch<LabResult>(`${LAB_BASE}/api/lab-results/${id}`, payload.status ? { ...payload, status: String(payload.status).toUpperCase() } : payload, {
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  }
};
