'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { canAccessArea, ROLE_HOME } from '@/features/auth/permissions';
import { ROUTES } from '@/lib/constants';

/**
 * Client-side route guard.
 *
 * <p>Complements (never replaces) backend authorisation: it stops a signed-in
 * user from landing on a page their role cannot use, and sends them to their own
 * dashboard instead. The API remains the authority — this is UX, not security.
 */
export function ProtectedGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const role = useAuthStore((state) => state.user?.role);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const home = (role && ROLE_HOME[role]) ? ROLE_HOME[role] : ROUTES.login;
  const isAreaAuthorized = Boolean(role && canAccessArea(pathname, role));

  /**
   * Whether a usable session exists.
   *
   * <p>Derived from the token and profile rather than read from the store's
   * `isAuthenticated` flag. That flag is not persisted (it is deliberately left out
   * of `partialize`, so it is rebuilt on rehydration), which left the gate reading
   * `false` on the first render after a reload — while the token and profile were
   * already restored. The gate then called `clearSession()`, wiping a perfectly good
   * session and bouncing a signed-in user to /login on any full page load.
   */
  const hasSession = Boolean(role && accessToken);

  useEffect(() => {
    if (!isHydrated) return;

    if (!hasSession) {
      clearSession();
      router.replace(ROUTES.login);
      return;
    }

    if (!isAreaAuthorized) {
      router.replace(home);
    }
  }, [accessToken, clearSession, hasSession, home, isAreaAuthorized, isHydrated, role, router]);

  if (!isHydrated || !hasSession || !isAreaAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedGate;