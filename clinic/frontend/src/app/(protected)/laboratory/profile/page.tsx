import { AccountPage } from '@/features/account/account-page';

/**
 * Laboratory technician profile.
 *
 * <p>Previously a bare box with the name, the email and a hardcoded "Department:
 * Laboratory". Now the shared account page, so it stays consistent with every other
 * role's profile.
 */
export default function Page() {
  return (
    <AccountPage
      title="Profile"
      description="Your laboratory account and the access your role grants."
      roleLabel="Laboratory technician"
    />
  );
}
