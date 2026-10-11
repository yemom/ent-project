import { AccountPage } from '@/features/account/account-page';

/**
 * Doctor settings.
 *
 * <p>Previously listed hardcoded preferences ("Consultation reminders enabled",
 * "Telehealth notifications enabled") that no backend ever stored. Displaying them
 * made the page look functional while every value was fiction, so it now shows the
 * real session instead.
 */
export default function Page() {
  return (
    <AccountPage
      title="Doctor Settings"
      description="Your account and the access your role grants."
      roleLabel="Doctor"
    />
  );
}
