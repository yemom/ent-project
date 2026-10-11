import { ProtectedGate } from '@/components/layouts/protected-gate';

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedGate>{children}</ProtectedGate>;
}
