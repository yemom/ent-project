import { searchMedicalRecords } from '@/services/api/medical-records';
import type { PageResponse } from '@/types/api';

export interface PrescriptionItem {
  id: string;
  patientName: string;
  drugName: string;
  dosage: string;
  status: 'ACTIVE' | 'PENDING' | 'DISCONTINUED';
  prescribedAt: string;
  patientId?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

export async function listPrescriptions(params: Record<string, string | number | undefined> = {}) {
  const data = await searchMedicalRecords(params);
  
  const items: PrescriptionItem[] = (data.content ?? [])
    .filter(record => !!record.prescription && record.prescription.trim().length > 0)
    .map(record => ({
      id: record.id,
      patientName: record.patient?.fullName || 'Unknown',
      patientId: (record as any).patient?.id,
      drugName: record.prescription!,
      dosage: 'As directed',
      status: 'ACTIVE',
      prescribedAt: record.recordDate || record.createdAt || new Date().toISOString(),
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      notes: record.notes
    }));
    
  return {
    ...data,
    content: items,
    totalElements: items.length
  } as PageResponse<PrescriptionItem>;
}

export async function createPrescription(payload: Record<string, unknown>) {
  throw new Error('Prescriptions cannot be created on their own. Please create or update a medical record instead.');
}

export default { listPrescriptions, createPrescription };
