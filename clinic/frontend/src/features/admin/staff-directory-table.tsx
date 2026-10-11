'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { listUsers } from '@/services/api/users';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { UserRole } from '@/types/api';

/**
 * Read-only staff list, filtered to one role.
 *
 * <p>Extracted so the staff directory pages and the laboratory page share one
 * implementation of "list accounts with this role" instead of each keeping its own
 * copy of the same query and filter.
 */
export function StaffDirectoryTable({
  role,
  emptyText,
}: {
  role: UserRole;
  emptyText: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { size: 200 }],
    queryFn: () => listUsers({ size: 200 }),
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const all = (data?.content ?? []) as unknown as Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      active?: boolean;
    }>;
    return all.filter((user) => user.role === role);
  }, [data, role]);

  if (error) {
    return <p className="text-sm text-destructive">{getFriendlyErrorMessage(error, 'Could not load staff.')}</p>;
  }

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
          <div className="min-w-0">
            <p className="font-medium">{row.fullName}</p>
            <p className="text-sm text-muted-foreground">{row.email}</p>
          </div>
          <Badge variant={row.active ? 'success' : 'outline'}>
            {row.active ? 'Active' : 'Deactivated'}
          </Badge>
        </div>
      ))}
    </div>
  );
}