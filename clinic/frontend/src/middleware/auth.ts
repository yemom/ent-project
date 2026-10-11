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
