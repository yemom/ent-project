"use client";

import { PageHeader } from '@/components/layouts/page-header';
import { useAuthStore } from '@/store/auth-store';

export default function Page() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="p-4 border rounded">
        <div className="text-sm font-medium">{user?.fullName}</div>
        <div className="text-xs text-muted-foreground">{user?.email}</div>
        <div className="mt-2">Department: Laboratory</div>
      </div>
    </div>
  );
}
