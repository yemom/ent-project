'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import type { LabOrder } from '../types';
import { LAB_ROUTES } from '@/lib/constants';

interface Props {
  order: LabOrder;
}

export function LabOrderCard({ order }: Props) {
  const statusVariant = (status: string) => {
    if (status === 'pending') return 'warning';
    if (status === 'in_progress') return 'secondary';
    if (status === 'completed') return 'success';
    return 'destructive';
  };

  const urgencyVariant = (u: string) => {
    if (u === 'urgent') return 'warning';
    if (u === 'critical') return 'destructive';
    return 'default';
  };

  return (
    <div className="border rounded-lg p-4 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-l ${order.urgency === 'critical' ? 'bg-red-500' : order.urgency === 'urgent' ? 'bg-amber-400' : 'bg-gray-300'}`} />
          <div>
            <div className="text-sm font-semibold text-slate-900">Patient: {order.patientName || order.patientId}</div>
            <div className="text-xs text-slate-500 font-medium">Ordered by: {order.doctorName || 'Dr. Practitioner'}</div>
            <div className="text-xs text-slate-400 mt-0.5">{order.tests.join(' • ')}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={statusVariant(order.status) as any}>{order.status}</Badge>
          <Badge variant={urgencyVariant(order.urgency) as any}>{order.urgency}</Badge>
          <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`${LAB_ROUTES.laboratoryOrders}/${order.id}`}>
          <Button variant="outline" size="sm">View</Button>
        </Link>
      </div>
    </div>
  );
}
