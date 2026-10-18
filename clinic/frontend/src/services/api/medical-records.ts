import { apiClient } from '@/services/api/client';
import { fetchAllPages } from '@/services/api/page-utils';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { PageResponse } from '@/types/api';

/**
 * Clinical records.
 *
 * <p>Two access paths exist, and which one you may use is decided by the server:
 *
 * <ul>
 *   <li>`/medical-records` and `/medical-records/search` are the clinician
 *       directories and require `diagnosis:write`.</li>
 *   <li>`/medical-records/me` is the patient's own listing. It requires
 *       `own_record:read` and derives the patient from the server-side principal,
 *       so there is deliberately no `patientId` parameter to pass.</li>
 * </ul>
 *
 * <p>The patient's own fields are projected separately from the clinician view: a
 * patient sees what happened to them, not the internal record-keeping columns
 * (confidentiality flags, authorship, record version).
 */
export interface ClinicianMedicalRecord {
  id: string;
  patient?: { id: string; fullName: string; email?: string } | null;
  doctor?: { id: string; fullName: string; email?: string } | null;
  appointment?: { id: string; appointmentDate?: string } | null;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  testResults: string | null;
  vitalSigns: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  notes: string | null;
  recordDate: string;
  medicalRecordType: string | null;
  isConfidential: boolean | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** One of the signed-in patient's own records, as `MyMedicalRecordResponse`. */
export interface OwnMedicalRecord {
  id: string;
  recordDate: string;
  medicalRecordType: string | null;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  testResults: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  notes: string | null;
  doctorName: string | null;
  /** Whether the clinician has signed off the record. */
  signed: boolean;
}

export interface OwnRecordsParams {
  fromDate?: string;
  toDate?: string;
  keyword?: string;
  /** Spring `Pageable` parameters, passed straight through. */
  page?: number;
  size?: number;
}

/**
 * A single page of the caller's own records.
 *
 * <p>Returns the page envelope rather than every match so the UI can paginate: a
 * patient with a long history should not download all of it to show ten rows.
 */
export async function listOwnMedicalRecords(
  params: OwnRecordsParams = {},
): Promise<PageResponse<OwnMedicalRecord>> {
  try {
    const { data } = await apiClient.get<PageResponse<OwnMedicalRecord>>('/medical-records/me', {
      params: { ...params },
    });
    return data;
  } catch (error) {
    throw new Error(
      getFriendlyErrorMessage(error, 'We could not load your medical records. Please try again.'),
    );
  }
}

/** Every page of the caller's own records, for callers that genuinely need them all. */
export async function listAllOwnMedicalRecords(
  params: OwnRecordsParams = {},
): Promise<PageResponse<OwnMedicalRecord>> {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<OwnMedicalRecord>>('/medical-records/me', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function getMedicalRecord(id: string): Promise<ClinicianMedicalRecord> {
  const { data } = await apiClient.get<ClinicianMedicalRecord>(`/medical-records/${id}`);
  return data;
}

export async function listMedicalRecords(
  params: Record<string, string | number | undefined> = {},
): Promise<PageResponse<ClinicianMedicalRecord>> {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<ClinicianMedicalRecord>>('/medical-records', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function searchMedicalRecords(
  params: Record<string, string | number | undefined> = {},
): Promise<PageResponse<ClinicianMedicalRecord>> {
  return fetchAllPages(async (page, size) => {
    const { data } = await apiClient.get<PageResponse<ClinicianMedicalRecord>>('/medical-records/search', {
      params: { ...params, page, size },
    });
    return data;
  });
}

export async function createMedicalRecord(payload: Record<string, unknown>) {
  const { data } = await apiClient.post<ClinicianMedicalRecord>('/medical-records', payload);
  return data;
}

export async function updateMedicalRecord(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.put<ClinicianMedicalRecord>(`/medical-records/${id}`, payload);
  return data;
}

export async function deleteMedicalRecord(id: string) {
  await apiClient.delete(`/medical-records/${id}`);
}
