"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, Stethoscope } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layouts/page-header';
import { LabResultForm } from '@/features/laboratory/components/lab-result-form';
import { LabResultView } from '@/features/laboratory/components/lab-result-view';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';
import type { LabOrder, LabResult } from '@/features/laboratory/types';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { LAB_ROUTES } from '@/lib/constants';

interface Props {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
  const { id } = React.use(params);
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrderAndResult = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const orderData = await labOrdersService.get(id);
      setOrder(orderData);
      const resultData = await labResultsService.getByLabOrderId(orderData.id);
      setResult(resultData);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not load the lab order.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrderAndResult();
  }, [id]);

  const handleStartProcessing = async () => {
    if (!order) return;
    try {
      setIsUpdating(true);
      await labOrdersService.updateStatus(order.id, 'in_progress');
      await loadOrderAndResult();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not start processing this order.'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitted = async (_submittedResult: LabResult, status: 'draft' | 'final') => {
    if (!order) return;
    try {
      setIsUpdating(true);
      await labOrdersService.updateStatus(order.id, status === 'final' ? 'completed' : 'in_progress');
      await loadOrderAndResult();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not update the lab order status.'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[420px] rounded-3xl" />
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Lab order unavailable</AlertTitle>
          <AlertDescription>{error || 'The requested order could not be loaded.'}</AlertDescription>
        </Alert>
        <Link href={LAB_ROUTES.laboratoryResults}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to results
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Result"
        description="Review the order, capture findings, and release the final result to the ordering doctor."
        actionLabel="Back to orders"
        actionHref={LAB_ROUTES.laboratoryOrders}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FlaskConical className="h-4 w-4" />
              Order details
            </div>
            <CardTitle className="text-2xl">{order.patientName || 'Unknown patient'}</CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">{order.status}</Badge>
              <Badge variant="secondary">{order.urgency}</Badge>
              <Badge variant="outline">Doctor: {order.doctorName || order.doctorId}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested tests</p>
              <p className="mt-1 text-sm">{order.tests.join(', ')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinical notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{order.clinicalNotes || 'No clinical notes were provided.'}</p>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900">
              <div className="flex items-center gap-2 font-semibold">
                <Stethoscope className="h-4 w-4" />
                Finalizing the result notifies the ordering doctor automatically.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <LabResultView order={order} result={result} />
            ) : order.status === 'pending' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Start processing this order before recording findings.</p>
                <Button className="w-full" onClick={handleStartProcessing} disabled={isUpdating}>
                  Start processing
                </Button>
              </div>
            ) : order.status === 'completed' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This order is marked completed, but no lab result was found. Reload the page or check the order record.
              </div>
            ) : (
              <LabResultForm order={order} onSubmitted={handleSubmitted} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
