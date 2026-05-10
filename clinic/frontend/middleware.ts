import type { NextRequest } from 'next/server';

export const protectedPrefixes = ['/admin', '/doctor', '/patient', '/pharmacist'];

export function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function getRequiredRole(pathname: string) {
  if (pathname.startsWith('/doctor')) return 'DOCTOR';
  if (pathname.startsWith('/patient')) return 'PATIENT';
  if (pathname.startsWith('/pharmacist')) return 'PHARMACIST';
  return 'ADMIN';
}

export function hasSession(request: NextRequest) {
  return request.cookies.get('clinic.auth')?.value === '1';
}

export function getRole(request: NextRequest) {
  return request.cookies.get('clinic.role')?.value ?? null;
}

export { isProtectedPath as isProtected, getRequiredRole as requiredRole };
