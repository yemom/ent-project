'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/page-header';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';
import { useAuthStore } from '@/store/auth-store';

type LabStats = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  readyToReview: number;
};

export function DoctorLabStatisticsPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<LabStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    readyToReview: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      if (!user?.id) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await labOrdersService.list({ doctorId: user.id, size: 100 });
        const orders = (data.content ?? []) as Array<{ id: string; status?: string }>;
        const completedOrders = orders.filter((order) => String(order.status).toLowerCase() === 'completed');
        const results = await Promise.all(
          completedOrders.map((order) => labResultsService.getByLabOrderId(order.id)),
        );

        if (!mounted) return;

        setStats({
          total: orders.length,
          pending: orders.filter((order) => String(order.status).toLowerCase() === 'pending').length,
          inProgress: orders.filter((order) => String(order.status).toLowerCase() === 'in_progress').length,
          completed: completedOrders.length,
          readyToReview: results.filter(Boolean).length,
        });
      } catch {
        if (mounted) {
          setStats({ total: 0, pending: 0, inProgress: 0, completed: 0, readyToReview: 0 });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void fetchStats();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Statistics"
        description="Exact laboratory workload and result counts for your patients."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <CardDescription>All lab orders submitted by you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700">{isLoading ? '...' : stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CardDescription>Awaiting laboratory processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{isLoading ? '...' : stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <CardDescription>Currently being analyzed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{isLoading ? '...' : stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CardDescription>Finalized laboratory orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? '...' : stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ready to Review</CardTitle>
            <CardDescription>Orders with results attached</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{isLoading ? '...' : stats.readyToReview}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
