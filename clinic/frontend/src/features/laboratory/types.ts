export type LabOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type LabResultStatus = 'draft' | 'final';
export type LabUrgency = 'routine' | 'urgent' | 'critical';

export interface LabOrder {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  appointmentId?: string | null;
  tests: string[];
  urgency: LabUrgency;
  clinicalNotes: string;
  status: LabOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  labTechnicianId: string;
  findings: Record<string, string> | string;
  fileUrl?: string | null;
  status: LabResultStatus;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export interface LabNotification {
  id: string;
  userId: string;
  type: 'lab_result_ready';
  message: string;
  labOrderId: string;
  labResultId: string;
  isRead: boolean;
  createdAt: string;
}

export interface CreateLabOrderDto {
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  tests: string[];
  urgency: LabUrgency;
  clinicalNotes?: string;
}

export interface SubmitLabResultDto {
  labOrderId: string;
  labTechnicianId: string;
  findings: Record<string, string> | string;
  fileUrl?: string | null;
  status: LabResultStatus;
}
