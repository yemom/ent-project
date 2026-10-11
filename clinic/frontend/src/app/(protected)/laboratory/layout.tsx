import { AppShell } from '@/components/layout/AppShell';

export default function LaboratoryLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="LAB_TECHNICIAN">{children}</AppShell>;
}
