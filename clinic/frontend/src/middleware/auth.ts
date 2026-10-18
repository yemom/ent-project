import type { NextRequest } from 'next/server';

export const protectedPrefixes = [
  '/admin',
  '/hospital',
  '/doctor',
  '/nurse',
  '/reception',
  '/laboratory',
  '/pharmacist',
  '/cashier',
  '/patient',
  // Shared assistant surface. What each role may actually ask about is decided by
  // the backend; the middleware only requires a session.
  '/ai',
];

export type ClinicRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'LABORATORY'
  | 'PHARMACIST'
  | 'CASHIER'
  | 'PATIENT';

/**
 * Every role the system knows about.
 *
 * <p>Derived from {@link ClinicRole} rather than written out, so adding a role to
 * the type does not silently leave this list behind — the mismatch would lock the
 * new role out of every shared page.
 */
export const ALL_ROLES: ClinicRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'LAB_TECHNICIAN',
  'LABORATORY',
  'PHARMACIST',
  'CASHIER',
  'PATIENT',
];

export function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getAllowedRoles(pathname: string): ClinicRole[] {
  if (pathname.startsWith('/admin')) return ['SUPER_ADMIN', 'ADMIN'];
  if (pathname.startsWith('/hospital')) return ['HOSPITAL_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
  if (pathname.startsWith('/doctor')) return ['DOCTOR'];
  if (pathname.startsWith('/nurse')) return ['NURSE'];
  if (pathname.startsWith('/reception')) return ['RECEPTIONIST', 'HOSPITAL_ADMIN'];
  if (pathname.startsWith('/laboratory')) return ['LAB_TECHNICIAN', 'LABORATORY'];
  if (pathname.startsWith('/pharmacist')) return ['PHARMACIST'];
  if (pathname.startsWith('/cashier')) return ['CASHIER'];
  if (pathname.startsWith('/patient')) return ['PATIENT'];
  // The assistant is offered to every role; the backend decides what each of them
  // may actually ask about. Listing all roles here keeps the middleware from
  // becoming a second, diverging copy of the permission matrix.
  if (pathname.startsWith('/ai')) return ALL_ROLES;
  return [];
}

export function hasSession(request: NextRequest): boolean {
  const cookie = request.cookies.get('clinic.auth')?.value;
  return Boolean(cookie && cookie !== '0');
}

export function getRole(request: NextRequest): ClinicRole | null {
  const role = request.cookies.get('clinic.role')?.value;
  if (!role) return null;

  const decoded = decodeURIComponent(role).toUpperCase();
  const validRoles: ClinicRole[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
    'LAB_TECHNICIAN',
    'LABORATORY',
    'PHARMACIST',
    'CASHIER',
    'PATIENT',
  ];

  if (validRoles.includes(decoded as ClinicRole)) {
    return decoded as ClinicRole;
  }

  return null;
}

export function dashboardForRole(role: ClinicRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'HOSPITAL_ADMIN':
      return '/hospital';
    case 'DOCTOR':
      return '/doctor';
    case 'NURSE':
      return '/nurse';
    case 'RECEPTIONIST':
      return '/reception';
    case 'LAB_TECHNICIAN':
    case 'LABORATORY':
      return '/laboratory';
    case 'PHARMACIST':
      return '/pharmacist';
    case 'CASHIER':
      return '/cashier';
    case 'PATIENT':
      return '/patient';
    default:
      return '/login';
  }
}

export function isRoleAllowed(role: ClinicRole, pathname: string): boolean {
  const allowed = getAllowedRoles(pathname);
  return allowed.includes(role);
}
