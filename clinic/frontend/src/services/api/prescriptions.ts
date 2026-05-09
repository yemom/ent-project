import { searchMedicalRecords } from '@/services/api/medical-records';
import type { PageResponse } from '@/types/api';

export interface PrescriptionItem {
  id: string;
  patientName: string;
  drugName: string;
  dosage: string;
  status: 'ACTIVE' | 'PENDING' | 'DISCONTINUED';
  prescribedAt: string;
}

export async function listPrescriptions(params: Record<string, string | number | undefined> = {}) {
  // Backend doesn't have a dedicated /prescriptions endpoint.
  // Prescriptions are stored as strings inside MedicalRecords.
  // We use searchMedicalRecords because it supports filtering by patientId, doctorId, etc.
  const data = await searchMedicalRecords(params);
  
  const items: PrescriptionItem[] = (data.content ?? [])
    .filter(record => !!record.prescription && record.prescription.trim().length > 0)
    .map(record => ({
      id: record.id,
      patientName: record.patient?.fullName || 'Unknown',
      drugName: record.prescription!, // Guaranteed by filter
      dosage: 'As directed',
      status: 'ACTIVE',
      prescribedAt: record.recordDate || record.createdAt || new Date().toISOString()
    }));
    
  return {
    ...data,
    content: items,
    totalElements: items.length
  } as PageResponse<PrescriptionItem>;
}

export async function createPrescription(payload: Record<string, unknown>) {
  throw new Error('Prescriptions cannot be created standalone. Create a Medical Record instead.');
}
