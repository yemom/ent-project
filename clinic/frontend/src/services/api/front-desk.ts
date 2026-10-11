import { apiClient } from '@/services/api/client';
import type {
  PageResponse,
  PatientAssignment,
  PatientDemographics,
  RegisterPatientPayload,
} from '@/types/api';

export type { PatientAssignment, PatientDemographics } from '@/types/api';

/** Front-desk endpoints: registration, check-in/queue, and doctor assignment. */
export const frontDeskApi = {
  registerPatient: async (payload: RegisterPatientPayload): Promise<PatientDemographics> => {
    const { data } = await apiClient.post<PatientDemographics>('/front-desk/patients', payload);
    return data;
  },

  checkIn: async (
    patientId: string,
    payload?: { checkedIn?: boolean; queuePosition?: number; notes?: string }
  ): Promise<PatientDemographics> => {
    const { data } = await apiClient.post<PatientDemographics>(
      `/front-desk/patients/${patientId}/check-in`,
      payload ?? { checkedIn: true }
    );
    return data;
  },

  /** Assigns a patient to a doctor; the backend notifies that doctor. */
  assignDoctor: async (
    patientId: string,
    payload: { doctorId: string; departmentId?: string; reason?: string }
  ): Promise<PatientAssignment> => {
    const { data } = await apiClient.post<PatientAssignment>(
      `/front-desk/patients/${patientId}/assign`,
      payload
    );
    return data;
  },

  releaseAssignment: async (patientId: string): Promise<PatientAssignment> => {
    const { data } = await apiClient.delete<PatientAssignment>(`/front-desk/patients/${patientId}/assign`);
    return data;
  },

  assignmentHistory: async (patientId: string): Promise<PatientAssignment[]> => {
    const { data } = await apiClient.get<PatientAssignment[]>(`/front-desk/patients/${patientId}/assignments`);
    return data;
  },

  availableDoctors: async (departmentId?: string) => {
    const { data } = await apiClient.get<
      Array<{
        id: string;
        fullName: string;
        email: string;
        specialization?: string;
        available?: boolean;
      }>
    >('/front-desk/doctors', { params: departmentId ? { departmentId } : undefined });
    return data;
  },

  /**
   * The signed-in doctor's own panel. No doctor id is sent — the server derives
   * it from the JWT, so one doctor cannot read another's list.
   */
  myPatients: async (params: { page?: number; size?: number } = {}): Promise<PageResponse<PatientDemographics>> => {
    const { data } = await apiClient.get<PageResponse<PatientDemographics>>('/front-desk/patients', { params });
    return data;
  },

  demographics: async (patientId: string): Promise<PatientDemographics> => {
    const { data } = await apiClient.get<PatientDemographics>(`/front-desk/patients/${patientId}`);
    return data;
  },
};

export default frontDeskApi;