import { AppShell } from '@/components/layout/AppShell';

export default function PharmacistLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="PHARMACIST">{children}</AppShell>;
}
