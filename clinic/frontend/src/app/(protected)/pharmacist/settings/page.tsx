import { redirect } from 'next/navigation';

/**
 * /pharmacist/settings
 *
 * <p>Previously rendered the profile page, so "Settings" and "Profile" were the same
 * screen under two names. There is no settings backend, so this link is redirected
 * to the one page that exists rather than duplicating it.
 */
export default function Page() {
  redirect('/pharmacist/profile');
}
