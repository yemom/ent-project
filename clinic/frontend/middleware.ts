import { NextRequest, NextResponse } from 'next/server';
import {
  dashboardForRole,
  isRoleAllowed,
  getRole,
  hasSession,
  isProtectedPath,
} from './src/middleware/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession(request)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const activeRole = getRole(request);

  if (activeRole && !isRoleAllowed(activeRole, pathname)) {
    return NextResponse.redirect(new URL(dashboardForRole(activeRole), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/hospital/:path*',
    '/doctor/:path*',
    '/nurse/:path*',
    '/reception/:path*',
    '/laboratory/:path*',
    '/pharmacist/:path*',
    '/cashier/:path*',
    '/patient/:path*',
  ],
};
