import { AccountPage } from '@/features/account/account-page';

/**
 * Front desk settings.
 *
 * <p>Was a "coming soon" placeholder. Reception preferences are not modelled by the
 * backend, so the page shows the real session rather than promising a feature that
 * does not exist.
 */
export default function Page() {
  return (
    <AccountPage
      title="Front Desk Settings"
      description="Your account and the access your role grants."
      roleLabel="Receptionist"
    />
  );
}
