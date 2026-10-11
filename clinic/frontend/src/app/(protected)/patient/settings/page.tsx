import { AccountPage } from '@/features/account/account-page';

/**
 * Patient settings.
 *
 * <p>Previously showed hardcoded "SMS reminders enabled" style cards backed by no
 * storage at all. Replaced with the real session.
 */
export default function Page() {
  return (
    <AccountPage
      title="Patient Settings"
      description="Your account and the access your role grants."
      roleLabel="Patient"
    />
  );
}
