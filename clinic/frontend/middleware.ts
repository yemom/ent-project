import { NextRequest, NextResponse } from 'next/server';
import { dashboardForRole, getRequiredRole, getRole, hasSession, isProtectedPath } from './src/middleware/auth';

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
    return NextResponse.redirect(new URL(dashboardForRole(activeRole), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/doctor/:path*', '/patient/:path*', '/pharmacist/:path*', '/laboratory/:path*']
};
