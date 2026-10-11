import { UserAccountsPage } from '@/features/admin/user-accounts-page';

/**
 * The unified account directory.
 *
 * <p>Replaces the old summary-only table: it now supports create, edit, activate,
 * deactivate and delete across every role, all against the real lifecycle endpoints.
 */
export default function Page() {
  return (
    <UserAccountsPage
      title="User accounts"
      description="Create, edit, activate, deactivate and delete every account in the clinic. Activation and deletion are audited, and the safety rules are enforced by the server rather than by this screen."
    />
  );
}
