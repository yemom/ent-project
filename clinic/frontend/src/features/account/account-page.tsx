'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layouts/page-header';
import { useAuthStore } from '@/store/auth-store';
import { useLogout } from '@/hooks/use-auth';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * The signed-in user's own account.
 *
 * <p>Backs the "Settings" and "Profile" links for every role.
 *
 * <p>There is deliberately no preferences form. The backend exposes no settings
 * endpoint, so a page offering toggles for "SMS reminders" or "telehealth
 * notifications" would be showing invented state that nothing reads and nothing
 * persists -- it would look functional and silently do nothing. Everything here is
 * read from the live session.
 *
 * <p>If preference storage is added later, this is the one place to put it, rather
 * than four near-identical pages that each drift differently.
 */
export function AccountPage({
  title,
  description,
  roleLabel,
}: {
  title: string;
  description: string;
  /** Optional role-specific detail shown under the account fields. */
  roleLabel?: string;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clearSession);
  const signOut = useLogout();

  const handleSignOut = async () => {
    // The store's clearSession also wipes token storage, so the local session is
    // always cleared -- even when the logout call fails, which can happen on a
    // dead connection and must not leave the button inert.
    try {
      await signOut.mutateAsync();
    } catch {
      clear();
    }
    router.replace('/login');
  };

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4" /> Account
          </CardTitle>
          <CardDescription>These details come from your live session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Full name" value={user?.fullName} />
          <Row label="Email" value={user?.email} />
          <Row
            label="Role"
            value={
              <Badge variant="outline">
                {roleLabel ?? user?.role?.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> What you can access
          </CardTitle>
          <CardDescription>
            Granted by your role and enforced by the API. Listed here so it is clear
            why a screen is or is not available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.permissions?.length ? (
            <div className="flex flex-wrap gap-2">
              {user.permissions.map((permission) => (
                <Badge key={permission} variant="secondary" className="font-mono text-xs">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No explicit permissions are attached to this session.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut} disabled={signOut.isPending}>
            {signOut.isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? 'Not provided'}</span>
    </div>
  );
}
