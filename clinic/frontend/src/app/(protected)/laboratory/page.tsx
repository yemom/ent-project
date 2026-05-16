"use client";

import { PageHeader } from '@/components/layouts/page-header';
import { LabOrderList } from '@/features/laboratory/components/lab-order-list';
import { useLabOrders } from '@/features/laboratory/hooks/use-lab-orders';

export default function Page() {
  const { orders, isLoading } = useLabOrders({ status: 'pending' });

  const pending = orders.filter((o) => o.status === 'pending').length;
  const inProgress = orders.filter((o) => o.status === 'in_progress').length;
  const completedToday = orders.filter((o) => new Date(o.updatedAt).toDateString() === new Date().toDateString() && o.status === 'completed').length;
  const totalWeek = orders.length;

  return (
    <div>
      <PageHeader title="Laboratory" description="Manage lab orders and results" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded border">Pending Orders<br/><div className="text-2xl font-bold">{pending}</div></div>
        <div className="p-4 rounded border">In Progress<br/><div className="text-2xl font-bold">{inProgress}</div></div>
        <div className="p-4 rounded border">Completed Today<br/><div className="text-2xl font-bold">{completedToday}</div></div>
        <div className="p-4 rounded border">Total This Week<br/><div className="text-2xl font-bold">{totalWeek}</div></div>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Recent Pending Orders</h2>
        <LabOrderList orders={orders.slice(0, 5)} />
      </div>
    </div>
  );
}
