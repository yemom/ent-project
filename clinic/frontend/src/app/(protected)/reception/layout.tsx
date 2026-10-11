import { AppShell } from '@/components/layout/AppShell';

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="RECEPTIONIST">{children}</AppShell>;
}
