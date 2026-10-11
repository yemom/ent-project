import { apiClient } from '@/services/api/client';
import type { UserRole } from '@/types/api';

/**
 * Account administration — the Super Admin surface for CREATE, VIEW, EDIT,
 * ACTIVATE/DEACTIVATE and DELETE across every role.
 *
 * <p>Kept beside the existing legacy helpers at the bottom of the file rather than in
 * a new module: both talk to `/admin/users`, and splitting one endpoint across two
 * files makes it far too easy to change one and forget the other.
 */

// --------------------------------------------------------------- shapes

/**
 * Role-specific profile fields.
 *
 * <p>A single record with optional parts rather than a union, because the response
 * always carries one `profile` object with only the fields relevant to the role
 * populated. That mirrors how the backend builds it.
 *
 * <p>For a patient this is demographics only. Diagnoses, prescriptions, records and
 * lab results are reachable through their own clinical endpoints, which Super Admin
 * does not hold.
 */
export interface UserProfile {
  // Doctor
  specialization?: string | null;
  licenseNumber?: string | null;
  yearsOfExperience?: number | null;
  qualifications?: string | null;
  consultationFee?: number | null;
  bio?: string | null;
  available?: boolean | null;
  // Pharmacist
  employeeNumber?: string | null;
  pharmacyLocation?: string | null;
  // Patient
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bloodType?: string | null;
  medicalHistory?: string | null;
  allergies?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  registrationNumber?: string | null;
  checkedInAt?: string | null;
}

/**
 * One account as the admin screens see it.
 *
 * <p>Note the absence of any password field: the backend never serializes the hash,
 * so there is nothing to accidentally render or log.
 */
export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  active: boolean;
  branchId?: string | null;
  mustChangePassword: boolean;
  deactivationReason?: string | null;
  deactivatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Present on the detail endpoint only; null in list rows. */
  profile?: UserProfile | null;
}

export interface CreateAccountRequest {
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  /** Omit to have the server generate one, returned once in the response. */
  password?: string;
  // Doctor
  specialization?: string;
  licenseNumber?: string;
  yearsOfExperience?: number;
  qualifications?: string;
  consultationFee?: number;
  bio?: string;
  available?: boolean;
  // Pharmacist
  employeeNumber?: string;
  pharmacyLocation?: string;
  // Patient
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  bloodType?: string;
  medicalHistory?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  registrationNumber?: string;
}

export interface UpdateAccountRequest {
  email?: string;
  fullName?: string;
  phone?: string;
  branchId?: string;
  specialization?: string;
  licenseNumber?: string;
  yearsOfExperience?: number;
  qualifications?: string;
  consultationFee?: number;
  bio?: string;
  available?: boolean;
  employeeNumber?: string;
  pharmacyLocation?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  bloodType?: string;
  medicalHistory?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  registrationNumber?: string;
}

/**
 * Create result.
 *
 * <p>`generatedPassword` is present only when the caller supplied no password. It is
 * the one and only time the credential is available, so the UI shows it once and
 * never stores it.
 */
export interface CreateAccountResult {
  user: ManagedUser;
  generatedPassword?: string | null;
}

export interface AccountSearchFilters {
  role?: UserRole;
  active?: boolean;
  branchId?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface ManagedUserPage {
  content: ManagedUser[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// --------------------------------------------------------------- endpoints

/**
 * The filtered account directory.
 *
 * <p>Filters are applied server-side. The alternative — pulling every account and
 * filtering in the browser — cannot page correctly: a page of 20 would be filtered
 * down to a handful while more matches sat on later pages.
 */
export async function searchAccounts(filters: AccountSearchFilters = {}): Promise<ManagedUserPage> {
  const { page = 0, size = 20, ...rest } = filters;
  const { data } = await apiClient.get<ManagedUserPage>('/admin/users/search', {
    params: { page, size, ...rest },
  });
  return data;
}

/** One account with its role-specific profile. */
export async function fetchAccount(id: string): Promise<ManagedUser> {
  const { data } = await apiClient.get<ManagedUser>(`/admin/users/${id}`);
  return data;
}

export async function createAccount(payload: CreateAccountRequest): Promise<CreateAccountResult> {
  const { data } = await apiClient.post<CreateAccountResult>('/admin/users/accounts', payload);
  return data;
}

export async function updateAccount(id: string, payload: UpdateAccountRequest): Promise<ManagedUser> {
  const { data } = await apiClient.put<ManagedUser>(`/admin/users/${id}/profile`, payload);
  return data;
}

/**
 * Changes an account's role.
 *
 * <p>A distinct endpoint from a profile edit because a role change alters what the
 * account can reach; it is audited separately and can be refused independently.
 */
export async function changeAccountRole(
  id: string,
  role: UserRole,
  reason?: string
): Promise<ManagedUser> {
  const { data } = await apiClient.patch<ManagedUser>(`/admin/users/${id}/role`, { role, reason });
  return data;
}

/**
 * Activates or deactivates an account.
 *
 * <p>A reason is mandatory when deactivating and the server rejects the request
 * without one, so the UI has to collect it.
 */
export async function changeAccountStatus(
  id: string,
  active: boolean,
  reason?: string
): Promise<ManagedUser> {
  const { data } = await apiClient.patch<ManagedUser>(`/admin/users/${id}/status`, { active, reason });
  return data;
}

/**
 * Soft-deletes an account. The row survives — appointments, medical records,
 * invoices and audit entries all reference it — but it leaves every list and can no
 * longer sign in.
 */
export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}/account`);
}

// --------------------------------------------------------------- legacy

export interface DoctorCreateRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  specialization: string;
  licenseNumber: string;
  yearsOfExperience?: number;
  qualifications?: string;
  /** Backend expects BigDecimal — must be a number, not a string */
  consultationFee?: number;
  bio?: string;
}

export interface PatientCreateRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  /** ISO date string e.g. "1990-05-20" */
  dateOfBirth?: string;
  /** Must match backend Gender enum: MALE | FEMALE | OTHER */
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  medicalHistory?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface InviteUserRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
}

export async function createDoctor(payload: DoctorCreateRequest) {
  const { data } = await apiClient.post('/doctors', payload);
  return data;
}

export async function createPatient(payload: PatientCreateRequest) {
  const { data } = await apiClient.post('/patients', payload);
  return data;
}

/**
 * Creates a staff account (PHARMACIST, LAB_TECHNICIAN, and the roles without a
 * dedicated endpoint).
 *
 * <p>Prefers {@link createAccount}, which is the canonical create endpoint and
 * supports every role including the ones needing profile fields. Kept because
 * callers exist that post the legacy flat shape.
 *
 * <p>Note the nested `user`: the response wraps the created account so that a
 * generated password is never mistaken for a field of the account itself.
 */
export async function inviteUser(
  payload: InviteUserRequest
): Promise<{ user: ManagedUser; generatedPassword: string | null }> {
  const { data } = await apiClient.post<{ user: ManagedUser; generatedPassword: string | null }>(
    '/admin/users',
    payload
  );
  return data;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
}

/**
 * Edits an account's profile through the legacy path.
 *
 * <p>Note there is no `active` field. Account status moved to
 * {@link changeAccountStatus} so that deactivating requires a recorded reason and is
 * audited on its own; a routine profile save must not be able to quietly suspend
 * somebody.
 *
 * <p>Returns the full account rather than the previous summary, so callers get the
 * same shape from both paths.
 */
export async function updateUser(id: string, payload: UpdateUserRequest): Promise<ManagedUser> {
  const { data } = await apiClient.put<ManagedUser>(`/admin/users/${id}`, payload);
  return data;
}

/** Soft delete via the legacy route; delegates to the same implementation server-side. */
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}

export async function updatePatient(id: string, payload: Partial<PatientCreateRequest>) {
  const { data } = await apiClient.put(`/patients/${id}`, payload);
  return data;
}

export async function deletePatient(id: string) {
  const { data } = await apiClient.delete(`/patients/${id}`);
  return data;
}

// ------------------------------------------------------------------- roles

/**
 * A submitted role change awaiting approval.
 *
 * <p>Changing an existing account's role through the dual-control workflow needs a
 * second privileged approver, so it is a request rather than an immediate write.
 * {@link changeAccountRole} is the direct Super Admin path.
 */
export interface RoleChangeRequest {
  id: string;
  targetUserId: string;
  targetUserEmail?: string | null;
  previousRole: string;
  targetRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByEmail?: string | null;
  reason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
}

export async function requestRoleChange(
  userId: string,
  targetRole: UserRole,
  reason?: string
): Promise<RoleChangeRequest> {
  const { data } = await apiClient.post<RoleChangeRequest>(
    `/admin/users/${userId}/role-requests`,
    { targetRole, reason }
  );
  return data;
}

export async function listRoleChangeRequests(params: { status?: string; page?: number; size?: number } = {}) {
  const { data } = await apiClient.get<{
    content: RoleChangeRequest[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  }>('/admin/role-requests', { params: { page: 0, size: 50, ...params } });
  return data;
}

export async function approveRoleChange(requestId: string, reason?: string) {
  const { data } = await apiClient.post(`/admin/role-requests/${requestId}/approve`, null, {
    params: reason ? { reason } : undefined,
  });
  return data;
}

export async function rejectRoleChange(requestId: string, reason?: string) {
  const { data } = await apiClient.post(`/admin/role-requests/${requestId}/reject`, null, {
    params: reason ? { reason } : undefined,
  });
  return data;
}

/** The role → permission matrix, used to render the Roles page. */
export async function fetchRolePermissions(): Promise<Record<string, string[]>> {
  const { data } = await apiClient.get<Record<string, string[]>>('/admin/permissions');
  return data;
}

// ------------------------------------------------------------ global search

/** One search result. `type` and `link` drive the icon and the navigation. */
export interface SearchHit {
  id: string;
  type: 'USER' | 'PATIENT' | 'DOCTOR' | 'APPOINTMENT' | 'INVOICE' | 'DEPARTMENT';
  title: string;
  subtitle: string;
  link: string;
}

/**
 * Grouped results. The server scopes every section to the caller's permissions,
 * so an empty section means "not permitted" or "no match" — never "hidden".
 */
export interface GlobalSearchResults {
  query: string;
  totalResults: number;
  users: SearchHit[];
  patients: SearchHit[];
  doctors: SearchHit[];
  appointments: SearchHit[];
  invoices: SearchHit[];
  departments: SearchHit[];
}

export async function globalSearch(q: string, limit = 5): Promise<GlobalSearchResults> {
  const { data } = await apiClient.get<GlobalSearchResults>('/admin/search', {
    params: { q, limit },
  });
  return data;
}

// ---------------------------------------------------------------- audit log

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  branchId?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export async function listAuditLogs(params: { action?: string; page?: number; size?: number } = {}) {
  const { data } = await apiClient.get<{
    content: AuditLogEntry[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  }>('/admin/audit-logs', { params: { page: 0, size: 50, ...params } });
  return data;
}
