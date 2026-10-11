import type { NextRequest } from 'next/server';

export const protectedPrefixes = ['/admin', '/doctor', '/patient', '/pharmacist', '/laboratory', '/nurse', '/receptionist', '/cashier'];

export type ClinicRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PHARMACIST' | 'LABORATORY' | 'NURSE' | 'RECEPTIONIST' | 'CASHIER';

export function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function getRequiredRole(pathname: string): ClinicRole {
  if (pathname.startsWith('/doctor')) return 'DOCTOR';
  if (pathname.startsWith('/patient')) return 'PATIENT';
  if (pathname.startsWith('/pharmacist')) return 'PHARMACIST';
  if (pathname.startsWith('/laboratory')) return 'LABORATORY';
  if (pathname.startsWith('/nurse')) return 'NURSE';
  if (pathname.startsWith('/receptionist')) return 'RECEPTIONIST';
  if (pathname.startsWith('/cashier')) return 'CASHIER';
  return 'ADMIN';
}

export function hasSession(request: NextRequest) {
  return request.cookies.get('clinic.auth')?.value === '1';
}

export function getRole(request: NextRequest): ClinicRole | null {
  const role = request.cookies.get('clinic.role')?.value;
  if (!role) return null;

  const decoded = decodeURIComponent(role);
  if (
    decoded === 'ADMIN' ||
    decoded === 'DOCTOR' ||
    decoded === 'PATIENT' ||
    decoded === 'PHARMACIST' ||
    decoded === 'LABORATORY' ||
    decoded === 'NURSE' ||
    decoded === 'RECEPTIONIST' ||
    decoded === 'CASHIER' 
  ) {
    return decoded;
  }

  return null;
}

export function dashboardForRole(role: ClinicRole) {
  if (role === 'DOCTOR') return '/doctor';
  if (role === 'PATIENT') return '/patient';
  if (role === 'NURSE') return '/nurse';
  if (role === 'RECEPTIONIST') return '/receptionist';
  if (role === 'CASHIER') return '/cashier';
  if (role === 'PHARMACIST') return '/pharmacist/dashboard';
  if (role === 'LABORATORY') return '/laboratory';
  return '/admin';
}
