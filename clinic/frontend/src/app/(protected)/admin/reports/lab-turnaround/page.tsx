'use client';

import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import type { LabOrder } from '@/features/laboratory/types';

export default function LabTurnaroundReportPage() {
  const { data: ordersPage, isLoading } = useQuery({
    queryKey: ['lab-orders', { page: 0, size: 50 }],
    queryFn: () => labOrdersService.list({ page: 0, size: 50 }),
  });

  const orders: LabOrder[] = ordersPage?.content || [];
  const completed = orders.filter((o) => o.status === 'completed').length;
  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Turnaround Report"
        description="Diagnostic workload, sample turnaround efficiency, and laboratory test fulfillment."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Total Orders</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? '...' : ordersPage?.totalElements ?? orders.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Diagnostic requests recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">In Progress / Pending</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {isLoading ? '...' : pending}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Processing in laboratory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Completed</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {isLoading ? '...' : completed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Results uploaded and released</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Laboratory Orders</CardTitle>
          <CardDescription>Live laboratory request records.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No laboratory orders found in database.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 15).map((ord) => (
                  <TableRow key={ord.id}>
                    <TableCell className="font-mono text-xs">{ord.id.substring(0, 8)}</TableCell>
                    <TableCell className="font-medium">
                      {ord.tests && ord.tests.length > 0 ? ord.tests.join(', ') : 'Standard Panel'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ord.urgency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ord.status === 'completed' ? 'default' : 'secondary'}>
                        {ord.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
