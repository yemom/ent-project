import { AppShell } from '@/components/layout/AppShell';

/**
 * Shell for the shared notification history.
 *
 * <p>Same reasoning as the assistant layout: this route is outside the per-role
 * directories, so it needs its own shell or it renders bare. No `role` prop —
 * `Sidebar` falls back to the authenticated user's role.
 */
export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
