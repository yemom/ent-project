import { AppShell } from '@/components/layout/AppShell';

export default function NurseLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="NURSE">{children}</AppShell>;
}
