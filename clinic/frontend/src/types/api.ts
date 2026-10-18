/**
 * Roles returned by the API. `ADMIN` and `LABORATORY` are legacy values kept so
 * previously issued tokens keep working; the backend maps them onto SUPER_ADMIN
 * and LAB_TECHNICIAN respectively.
 */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'PHARMACIST'
  | 'CASHIER'
  | 'PATIENT'
  | 'ADMIN'
  | 'LABORATORY';

/**
 * Canonical role: collapses the legacy aliases. Mirrors `UserRole#canonical()`
 * on the backend so client-side gating matches server-side authorisation.
 */
export const CANONICAL_ROLE: Record<string, UserRole> = {
  ADMIN: 'SUPER_ADMIN',
  LABORATORY: 'LAB_TECHNICIAN',
};

export function canonicalRole(role?: string | null): UserRole | null {
  if (!role) return null;
  return (CANONICAL_ROLE[role] ?? role) as UserRole;
}

/**
 * An appointment as the schedule tables present it.
 *
 * <p>This is a view model, not the API contract. The wire shape is
 * `AppointmentRecord` in `services/api/appointments`; this flattens the time to a
 * clock string and the free-text reason to a `type` so the existing schedule
 * screens keep their column layout.
 *
 * <p>`status` and `type` widened to `string`: they were declared as narrow literal
 * unions that the server has never used (`IN_PROGRESS`, `PENDING`, `TELEHEALTH` are
 * not in `AppointmentStatus`), so every real value needed a cast to satisfy them.
 */
export interface Appointment {
  id: string;
  time: string;
  patient: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  status: string;
  room?: string;
  type: string;
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
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
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
  /**
   * Permission strings from the backend's central matrix. The frontend only
   * hides UI the caller cannot use; the API remains the authority.
   */
  permissions?: string[];
}

// Front desk / assignment
export interface PatientDemographics {
  id: string;
  registrationNumber: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  branchId: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  assignedDoctorId: string | null;
  assignedDoctorName: string | null;
}

export interface PatientAssignment {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string;
  doctorName: string | null;
  departmentId: string | null;
  queuePosition: number | null;
  assignedById: string | null;
  assignedByName: string | null;
  reason: string | null;
  active: boolean;
  assignedAt: string;
  releasedAt: string | null;
}

export interface RegisterPatientPayload {
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  branchId?: string;
  registrationNumber?: string;
}