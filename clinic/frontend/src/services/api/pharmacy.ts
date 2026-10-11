import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

/**
 * Pharmacy inventory.
 *
 * <p>Quantities are always derived from batches on the server — this module never
 * computes a stock level itself, so the screen cannot disagree with the ledger.
 */

export interface Medicine {
  id: string;
  name: string;
  code: string;
  category: string;
  form?: string | null;
  strength?: string | null;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  requiresPrescription: boolean;
  active: boolean;
  createdAt: string;
}

export interface StockBatch {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  stockValue: number;
  receivedAt: string;
  notes?: string | null;
  expired: boolean;
  expiringSoon: boolean;
}

export type MovementKind = 'RECEIVED' | 'DISPENSED' | 'RETURNED' | 'DAMAGED' | 'EXPIRED' | 'ADJUSTED';

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId?: string | null;
  batchNumber?: string | null;
  kind: MovementKind;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  reference?: string | null;
  reason?: string | null;
  performedById?: string | null;
  performedByName?: string | null;
  prescriptionOrderId?: string | null;
  performedAt: string;
}

/** A catalogue entry with its derived live stock position. */
export interface MedicineWithStock {
  medicine: Medicine;
  totalLiveStock: number;
  reorderLevel: number;
  lowStock: boolean;
  outOfStock: boolean;
  batches: StockBatch[];
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
  createdAt: string;
}

export interface PharmacyAlerts {
  outOfStock: Medicine[];
  lowStock: Medicine[];
  expiringSoon: StockBatch[];
  expired: StockBatch[];
}

export interface PharmacySummary {
  medicines: number;
  suppliers: number;
  stockValue: number;
  valueReceivedInPeriod: number;
  costOfGoodsDispensedInPeriod: number;
  movementsByKind: Record<MovementKind, number>;
  outOfStock: number;
  lowStock: number;
  expiringSoon: number;
  expired: number;
}

export const PHARMACY_KEYS = {
  medicines: (q?: string, category?: string, alertsOnly?: boolean) =>
    ['pharmacy', 'medicines', q ?? '', category ?? '', alertsOnly ? 'alerts' : 'all'] as const,
  medicine: (id: string) => ['pharmacy', 'medicine', id] as const,
  batches: (medicineId?: string) => ['pharmacy', 'batches', medicineId ?? 'all'] as const,
  movements: (medicineId?: string, kind?: string) =>
    ['pharmacy', 'movements', medicineId ?? 'all', kind ?? 'all'] as const,
  suppliers: () => ['pharmacy', 'suppliers'] as const,
  alerts: () => ['pharmacy', 'alerts'] as const,
  summary: () => ['pharmacy', 'summary'] as const,
  categories: () => ['pharmacy', 'categories'] as const,
};

export async function listMedicines(params: {
  q?: string;
  category?: string;
  alertsOnly?: boolean;
} = {}): Promise<PageResponse<MedicineWithStock>> {
  const { data } = await apiClient.get<PageResponse<MedicineWithStock>>('/pharmacy/medicines', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function getMedicine(id: string): Promise<MedicineWithStock> {
  const { data } = await apiClient.get<MedicineWithStock>(`/pharmacy/medicines/${id}`);
  return data;
}

export async function createMedicine(payload: {
  name: string;
  code: string;
  category?: string;
  form?: string;
  strength?: string;
  unit?: string;
  reorderLevel?: number;
  unitCost?: number;
  requiresPrescription?: boolean;
  active?: boolean;
}): Promise<Medicine> {
  const { data } = await apiClient.post<Medicine>('/pharmacy/medicines', payload);
  return data;
}

export async function updateMedicine(
  id: string,
  payload: Partial<Parameters<typeof createMedicine>[0]>
): Promise<Medicine> {
  const { data } = await apiClient.put<Medicine>(`/pharmacy/medicines/${id}`, payload);
  return data;
}

export async function deleteMedicine(id: string): Promise<void> {
  await apiClient.delete(`/pharmacy/medicines/${id}`);
}

export async function listCategories(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/pharmacy/categories');
  return data;
}

export async function listBatches(medicineId?: string): Promise<PageResponse<StockBatch>> {
  const { data } = await apiClient.get<PageResponse<StockBatch>>('/pharmacy/batches', {
    params: { page: 0, size: 50, medicineId },
  });
  return data;
}

export async function receiveStock(payload: {
  medicineId: string;
  supplierId?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
}): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>('/pharmacy/receipts', payload);
  return data;
}

export async function recordMovement(payload: {
  batchId: string;
  kind: MovementKind;
  quantity: number;
  prescriptionOrderId?: string;
  reference?: string;
  reason?: string;
}): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>('/pharmacy/movements', payload);
  return data;
}

export async function listMovements(params: { medicineId?: string; kind?: string } = {}) {
  const { data } = await apiClient.get<PageResponse<StockMovement>>('/pharmacy/movements', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await apiClient.get<Supplier[]>('/pharmacy/suppliers');
  return data;
}

export async function createSupplier(payload: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  active?: boolean;
}): Promise<Supplier> {
  const { data } = await apiClient.post<Supplier>('/pharmacy/suppliers', payload);
  return data;
}

export async function updateSupplier(
  id: string,
  payload: Partial<Parameters<typeof createSupplier>[0]>
): Promise<Supplier> {
  const { data } = await apiClient.put<Supplier>(`/pharmacy/suppliers/${id}`, payload);
  return data;
}

export async function fetchAlerts(): Promise<PharmacyAlerts> {
  const { data } = await apiClient.get<PharmacyAlerts>('/pharmacy/alerts');
  return data;
}

export async function fetchPharmacySummary(params: { from?: string; to?: string } = {}) {
  const { data } = await apiClient.get<PharmacySummary>('/pharmacy/summary', {
    params: { from: params.from, to: params.to },
  });
  return data;
}