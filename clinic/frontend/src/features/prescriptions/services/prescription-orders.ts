import apiClient from '@/lib/api-client';

export interface PrescriptionOrderItem {
  id: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  drugName: string;
  dosage: string;
  instructions: string;
  status: 'PENDING' | 'DISPENSED' | 'REJECTED';
  orderedAt: string;
  dispensedAt: string | null;
}

export interface CreatePrescriptionOrderPayload {
  doctorId: string;
  doctorName: string;
  patientName: string;
  drugName: string;
  dosage: string;
  instructions?: string;
}

export interface UpdatePrescriptionOrderStatusPayload {
  status: 'PENDING' | 'DISPENSED' | 'REJECTED';
}

export interface UpdatePrescriptionOrderPayload {
  patientName?: string;
  drugName?: string;
  dosage?: string;
  instructions?: string;
}

export async function listPrescriptionOrders(params?: { page?: number; size?: number; status?: 'PENDING' | 'DISPENSED' | 'REJECTED'; patientName?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.size) query.append('size', params.size.toString());
  if (params?.status) query.append('status', params.status);
  if (params?.patientName) query.append('patientName', params.patientName);

  const response = await apiClient.get(`/prescription-orders${query.toString() ? `?${query.toString()}` : ''}`);
  return response.data;
}

export async function getPrescriptionOrderById(id: string) {
  const response = await apiClient.get(`/prescription-orders/${id}`);
  return response.data;
}

export async function listPrescriptionOrdersByDoctor(doctorId: string, params?: { page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.size) query.append('size', params.size.toString());

  const response = await apiClient.get(`/prescription-orders/filter/by-doctor/${doctorId}${query.toString() ? `?${query.toString()}` : ''}`);
  return response.data;
}

export async function createPrescriptionOrder(payload: CreatePrescriptionOrderPayload) {
  const response = await apiClient.post('/prescription-orders', payload);
  return response.data;
}

export async function updatePrescriptionOrderStatus(id: string, payload: UpdatePrescriptionOrderStatusPayload) {
  const response = await apiClient.patch(`/prescription-orders/${id}/status`, payload);
  return response.data;
}

export async function updatePrescriptionOrder(id: string, payload: UpdatePrescriptionOrderPayload) {
  const response = await apiClient.patch(`/prescription-orders/${id}`, payload);
  return response.data;
}

export async function deletePrescriptionOrder(id: string) {
  const response = await apiClient.delete(`/prescription-orders/${id}`);
  return response.data;
}

export default {
  listPrescriptionOrders,
  getPrescriptionOrderById,
  listPrescriptionOrdersByDoctor,
  createPrescriptionOrder,
  updatePrescriptionOrderStatus,
  updatePrescriptionOrder,
  deletePrescriptionOrder
};
