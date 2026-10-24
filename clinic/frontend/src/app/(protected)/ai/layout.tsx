import { AppShell } from '@/components/layout/AppShell';

/**
 * Shell for the assistant, which every role can reach.
 *
 * <p>The route sits outside the per-role directories, so without this layout it
 * would render with no sidebar, no notification bell and no way back. `AppShell` is
 * given no `role`: `Sidebar` prefers the signed-in user's role over the prop, which
 * is what lets one layout serve all nine roles.
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
