import { PageHeader } from '@/components/layouts/page-header';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { LabResultForm } from '@/features/laboratory/components/lab-result-form';
import { LabResultView } from '@/features/laboratory/components/lab-result-view';
import Link from 'next/link';
import { LAB_ROUTES } from '@/lib/constants';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const order = await labOrdersService.get(id);

  return (
    <div>
      <PageHeader title="Lab Order Details" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="p-4 border rounded">
            <div className="font-medium">Patient: {order.patientId}</div>
            <div className="mt-2">Doctor: {order.doctorId}</div>
            <div className="mt-2">Clinical Notes: {order.clinicalNotes}</div>
            <div className="mt-2">Tests: {order.tests.join(', ')}</div>
            <div className="mt-2">Urgency: {order.urgency}</div>
            <div className="mt-2">Status: {order.status}</div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="p-4 border rounded">
            {order.status === 'pending' && (
              <button
                type="button"
                onClick={async () => {
                  await labOrdersService.updateStatus(order.id, 'in_progress');
                  window.location.reload();
                }}
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Start Processing
              </button>
            )}

            {order.status === 'in_progress' && <LabResultForm order={order} onSubmitted={() => window.location.reload()} />}

            {order.status === 'completed' && <LabResultView order={order} />}

            <div className="mt-4">
              <Link href={LAB_ROUTES.laboratoryOrders} className="text-sm text-primary underline">
                Back to orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
