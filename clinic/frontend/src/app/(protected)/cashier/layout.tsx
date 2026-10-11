import { AppShell } from '@/components/layout/AppShell';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="CASHIER">{children}</AppShell>;
}
