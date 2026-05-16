'use client';

import { LabOrderCard } from './lab-order-card';
import type { LabOrder } from '../types';

interface Props {
  orders: LabOrder[];
}

export function LabOrderList({ orders }: Props) {
  if (!orders || orders.length === 0) {
    return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No lab orders found.</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <LabOrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}
