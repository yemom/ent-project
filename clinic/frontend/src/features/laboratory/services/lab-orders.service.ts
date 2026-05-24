import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';
import type { CreateLabOrderDto, LabOrder } from '../types';

// The lab-orders backend controller is at /api/lab-orders (no /v1 in path)
// The main apiClient base URL is http://localhost:8080/api/v1, so we use
// the raw base without the /v1 suffix for these endpoints.
const LAB_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/api\/v1$/, '');

function getAuthHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const labOrdersService = {
  create: async (payload: CreateLabOrderDto): Promise<LabOrder> => {
    const res = await axios.post<LabOrder>(`${LAB_BASE}/api/lab-orders`, payload, {
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  },
  list: async (params?: Record<string, any>): Promise<{ content: LabOrder[]; totalElements: number; totalPages: number }> => {
    const queryParams = { ...params };
    if (queryParams.status) {
      queryParams.status = String(queryParams.status).toUpperCase();
    }
    const res = await axios.get(`${LAB_BASE}/api/lab-orders`, {
      params: queryParams,
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  },
  get: async (id: string): Promise<LabOrder> => {
    const res = await axios.get<LabOrder>(`${LAB_BASE}/api/lab-orders/${id}`, {
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  },
  updateStatus: async (id: string, status: string): Promise<LabOrder> => {
    const res = await axios.patch<LabOrder>(`${LAB_BASE}/api/lab-orders/${id}/status`, { status: String(status).toUpperCase() }, {
      headers: { ...getAuthHeader() },
      withCredentials: true
    });
    return res.data;
  }
};
