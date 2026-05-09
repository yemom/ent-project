import { NextRequest, NextResponse } from 'next/server';
import { getRequiredRole, getRole, hasSession, isProtectedPath } from './src/middleware/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession(request)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const activeRole = getRole(request);
  const requiredRole = getRequiredRole(pathname);

  if (activeRole && activeRole !== requiredRole) {
    const target = activeRole === 'DOCTOR' ? '/doctor' : activeRole === 'PATIENT' ? '/patient' : '/admin';
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/doctor/:path*', '/patient/:path*']
};
