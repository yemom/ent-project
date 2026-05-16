"use client";

import { PageHeader } from '@/components/layouts/page-header';
import { useLabOrders } from '@/features/laboratory/hooks/use-lab-orders';
import { LabOrderList } from '@/features/laboratory/components/lab-order-list';

export default function Page() {
  const { orders, isLoading } = useLabOrders();

  return (
    <div>
      <PageHeader title="Lab Orders" />
      <div className="mt-4">
        <LabOrderList orders={orders} />
      </div>
    </div>
  );
}
