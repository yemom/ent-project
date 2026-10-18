import { AccountPage } from '@/features/account/account-page';

/**
 * Nurse settings.
 *
 * <p>There is no nurse-specific settings backend, so this shows the real session
 * and the access the role grants rather than a page of preferences nothing saves.
 *
 * <p>The link previously pointed here from the sidebar while no such route existed,
 * which produced a branded 404. `npm run verify:navigation` now fails the build on
 * any such link.
 */
export default function Page() {
  return (
    <AccountPage
      title="Nurse Settings"
      description="Your account and the access your role grants."
      roleLabel="Nurse"
    />
  );
}