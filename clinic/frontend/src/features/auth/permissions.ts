/**
 * Single source of truth for role → navigation.
 *
 * Permission strings come from `PERMISSIONS` (mirrored by the backend
 * `Permission` enum) so the sidebar and the route guards filter from exactly
 * the same list the API enforces.
 */
export const PERMISSIONS = {
  // Administration
  SETTINGS_MANAGE: 'settings:manage',
  BRANCH_MANAGE: 'branch:manage',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  AUDIT_READ: 'audit:read',
  DEPARTMENT_MANAGE: 'department:manage',
  STAFF_MANAGE: 'staff:manage',
  WARD_MANAGE: 'ward:manage',
  ROOM_MANAGE: 'room:manage',
  REPORT_READ: 'report:read',

  // Clinical
  DIAGNOSIS_WRITE: 'diagnosis:write',
  TREATMENT_PLAN_WRITE: 'treatment_plan:write',
  PRESCRIPTION_WRITE: 'prescription:write',
  PRESCRIPTION_DISPENSE: 'prescription:dispense',
  PRESCRIPTION_VERIFY: 'prescription:verify',
  LAB_ORDER_CREATE: 'lab_order:create',
  LAB_ORDER_READ: 'lab_order:read',
  LAB_RESULT_WRITE: 'lab_result:write',
  LAB_RESULT_VALIDATE: 'lab_result:validate',
  INVENTORY_MANAGE: 'inventory:manage',
  BATCH_MANAGE: 'batch:manage',
  VITAL_WRITE: 'vital:write',
  MEDICATION_ADMINISTER: 'medication:administer',
  ADMISSION_WRITE: 'admission:write',

  // Front desk / scheduling
  PATIENT_REGISTER: 'patient:register',
  PATIENT_DEMOGRAPHICS_READ: 'patient:demographics:read',
  /**
   * Administrative access to the patient directory (name, email, phone, registration
   * number). Separate from demographics read so an administrator can see who is
   * registered without acquiring the clinical permission that also opens medical
   * records.
   */
  PATIENT_DIRECTORY_READ: 'patient:directory:read',
  /** Reading one's own clinical record; the API scopes it to the caller. */
  OWN_RECORD_READ: 'own_record:read',
  PATIENT_ASSIGN: 'patient:assign',
  APPOINTMENT_MANAGE: 'appointment:manage',
  QUEUE_MANAGE: 'queue:manage',
  CHECK_IN: 'checkin:write',

  // Billing
  INVOICE_READ: 'invoice:read',
  PAYMENT_CREATE: 'payment:create',
  RECEIPT_READ: 'receipt:read',
  REFUND_CREATE: 'refund:create',
  REFUND_APPROVE: 'refund:approve',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type UserRoleValue =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'PHARMACIST'
  | 'CASHIER'
  | 'PATIENT';

/**
 * Backend-aligned permission matrix. `ADMIN` and `LABORATORY` are legacy aliases
 * resolved just below, so a stale token still gates the same way.
 */
const RAW_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  // Platform administration only — explicitly NO clinical data.
  SUPER_ADMIN: [
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.BRANCH_MANAGE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORT_READ,
    // Administrative reads across the operational directories.
    PERMISSIONS.PATIENT_DIRECTORY_READ,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.LAB_ORDER_READ,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.RECEIPT_READ,
    // Only privileged roles can approve a large refund or a role change.
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.BATCH_MANAGE,
  ],
  // Hospital operations — no diagnoses or prescriptions.
  HOSPITAL_ADMIN: [
    PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.WARD_MANAGE,
    PERMISSIONS.ROOM_MANAGE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.PATIENT_REGISTER,
    PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
    PERMISSIONS.REFUND_APPROVE,
  ],
  DOCTOR: [
    PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
    PERMISSIONS.DIAGNOSIS_WRITE,
    PERMISSIONS.TREATMENT_PLAN_WRITE,
    PERMISSIONS.PRESCRIPTION_WRITE,
    PERMISSIONS.LAB_ORDER_CREATE,
    PERMISSIONS.LAB_ORDER_READ,
    PERMISSIONS.ADMISSION_WRITE,
  ],
  NURSE: [
    PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
    PERMISSIONS.VITAL_WRITE,
    PERMISSIONS.MEDICATION_ADMINISTER,
  ],
  RECEPTIONIST: [
    PERMISSIONS.PATIENT_REGISTER,
    PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
    PERMISSIONS.CHECK_IN,
    PERMISSIONS.PATIENT_ASSIGN,
    PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.QUEUE_MANAGE,
  ],
  LAB_TECHNICIAN: [
    PERMISSIONS.LAB_ORDER_READ,
    PERMISSIONS.LAB_RESULT_WRITE,
    PERMISSIONS.LAB_RESULT_VALIDATE,
    PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
  ],
  PHARMACIST: [
    PERMISSIONS.PRESCRIPTION_VERIFY,
    PERMISSIONS.PRESCRIPTION_DISPENSE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.BATCH_MANAGE,
  ],
  CASHIER: [PERMISSIONS.INVOICE_READ, PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.RECEIPT_READ, PERMISSIONS.REFUND_CREATE],
  PATIENT: [PERMISSIONS.APPOINTMENT_MANAGE, PERMISSIONS.OWN_RECORD_READ],
};

/** Permissions granted to a role, expanding the legacy aliases. */
export function permissionsForRole(role?: string | null): readonly Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: string | undefined | null, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function roleHasAnyPermission(role: string | undefined | null, permissions: readonly Permission[]): boolean {
  const granted = permissionsForRole(role);
  return permissions.some((permission) => granted.includes(permission));
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Super Admin',
  HOSPITAL_ADMIN: 'Hospital Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  LAB_TECHNICIAN: 'Lab Technician',
  PHARMACIST: 'Pharmacist',
  CASHIER: 'Cashier',
  PATIENT: 'Patient',
  LABORATORY: 'Lab Technician',
};

/**
 * Raw matrix as declared, keyed by role. Legacy aliases resolve through
 * {@link ROLE_PERMISSIONS} so a stored `ADMIN` token behaves like SUPER_ADMIN.
 */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  ...RAW_ROLE_PERMISSIONS,
  // `ADMIN` is an alias of SUPER_ADMIN and carries exactly the same grants.
  ADMIN: RAW_ROLE_PERMISSIONS.SUPER_ADMIN,
  // `LABORATORY` is an alias of LAB_TECHNICIAN.
  LABORATORY: RAW_ROLE_PERMISSIONS.LAB_TECHNICIAN,
};

/** Route each role lands on after login / when hitting an unauthorised URL. */
export const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  ADMIN: '/admin',
  HOSPITAL_ADMIN: '/reception',
  DOCTOR: '/doctor',
  NURSE: '/nurse',
  RECEPTIONIST: '/reception',
  LAB_TECHNICIAN: '/laboratory',
  LABORATORY: '/laboratory',
  PHARMACIST: '/pharmacist/dashboard',
  CASHIER: '/cashier',
  PATIENT: '/patient',
};

/** URL prefix → role that owns that area. Used by the route guard. */
export const AREA_ROLE: { prefix: string; roles: readonly string[] }[] = [
  { prefix: '/admin', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/hospital', roles: ['HOSPITAL_ADMIN'] },
  { prefix: '/doctor', roles: ['DOCTOR'] },
  { prefix: '/nurse', roles: ['NURSE'] },
  { prefix: '/reception', roles: ['RECEPTIONIST', 'HOSPITAL_ADMIN'] },
  { prefix: '/laboratory', roles: ['LABORATORY', 'LAB_TECHNICIAN'] },
  { prefix: '/pharmacist', roles: ['PHARMACIST'] },
  { prefix: '/cashier', roles: ['CASHIER'] },
  { prefix: '/patient', roles: ['PATIENT'] },
];

export function rolesAllowedInArea(pathname: string): readonly string[] | null {
  const match = AREA_ROLE.find((area) => pathname === area.prefix || pathname.startsWith(`${area.prefix}/`));
  return match ? match.roles : null;
}

export function canAccessArea(pathname: string, role?: string | null): boolean {
  const allowed = rolesAllowedInArea(pathname);
  if (!allowed) return true;
  if (!role) return false;
  // SUPER_ADMIN is not a clinical role: it has no business in clinical areas.
  return allowed.includes(role);
}