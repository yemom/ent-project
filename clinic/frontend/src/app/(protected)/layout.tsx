import { AppShell } from '@/components/layouts/app-shell';
import { ProtectedGate } from '@/components/layouts/protected-gate';

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedGate>
      <AppShell>{children}</AppShell>
    </ProtectedGate>
  );
}
