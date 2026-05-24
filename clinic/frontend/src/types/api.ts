export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PHARMACIST' | 'LABORATORY';

// Appointment
export interface Appointment {
  id: string;
  time: string;
  patient: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'PENDING' | 'CANCELLED';
  room?: string;
  type: 'CHECKUP' | 'FOLLOW_UP' | 'SURGERY' | 'TELEHEALTH';
}

// Prescription
export interface Prescription {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'DISCONTINUED';
  issuedAt: string;
}

// Dashboard stats
export interface DoctorStats {
  todayAppointmentsCount: number;
  pendingNotesCount: number;
  prescriptionsSentCount: number;
}

export interface ApiErrorResponse {
  message: string;
  status?: number;
  code?: string;
  details?: Record<string, string[]>;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
}
