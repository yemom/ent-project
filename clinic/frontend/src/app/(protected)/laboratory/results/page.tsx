"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FilePlus2, FlaskConical, Loader2, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LabResultForm } from '@/features/laboratory/components/lab-result-form';
import { LabResultView } from '@/features/laboratory/components/lab-result-view';
import { useLabOrders } from '@/features/laboratory/hooks/use-lab-orders';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';
import type { LabOrder, LabResult } from '@/features/laboratory/types';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

function normalizeLabStatus(status?: string) {
  return String(status ?? '').toLowerCase();
}

function normalizeUrgency(urgency?: string) {
  return String(urgency ?? '').toLowerCase();
}

export default function Page() {
  const { orders, isLoading, error, refetch } = useLabOrders();
  const activeOrders = useMemo(
    () => orders.filter((order) => normalizeLabStatus(order.status) !== 'completed'),
    [orders]
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedOrderId && activeOrders.length > 0) {
      setSelectedOrderId(activeOrders[0].id);
    }
  }, [activeOrders, selectedOrderId]);

  useEffect(() => {
    let mounted = true;

    async function loadSelectedOrder() {
      if (!selectedOrderId) {
        setSelectedOrder(null);
        setSelectedResult(null);
        return;
      }

      try {
        setIsLoadingDetail(true);
        setDetailError(null);
        const order = await labOrdersService.get(selectedOrderId);
        if (!mounted) return;
        setSelectedOrder(order);
        const result = await labResultsService.getByLabOrderId(order.id);
        if (!mounted) return;
        setSelectedResult(result);
      } catch (err) {
        if (!mounted) return;
        setDetailError(getFriendlyErrorMessage(err, 'Could not load the selected lab order.'));
      } finally {
        if (mounted) setIsLoadingDetail(false);
      }
    }

    void loadSelectedOrder();

    return () => {
      mounted = false;
    };
  }, [selectedOrderId]);

  const handleStartProcessing = async () => {
    if (!selectedOrder) return;
    try {
      setIsUpdating(true);
      await labOrdersService.updateStatus(selectedOrder.id, 'in_progress');
      await refetch();
      const updatedOrder = await labOrdersService.get(selectedOrder.id);
      setSelectedOrder(updatedOrder);
    } catch (err) {
      setDetailError(getFriendlyErrorMessage(err, 'Could not start processing this order.'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailError(null);
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCreateResult = async () => {
    if (!selectedOrder) {
      if (activeOrders.length > 0) {
        handleOpenOrder(activeOrders[0].id);
      }
      return;
    }

    if (normalizeLabStatus(selectedOrder.status) === 'pending') {
      await handleStartProcessing();
      window.requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmitted = async (_result: LabResult, status: 'draft' | 'final') => {
    if (!selectedOrder) return;
    try {
      setIsUpdating(true);
      await labOrdersService.updateStatus(selectedOrder.id, status === 'final' ? 'completed' : 'in_progress');
      await refetch();
      const updatedOrder = await labOrdersService.get(selectedOrder.id);
      setSelectedOrder(updatedOrder);
      const updatedResult = await labResultsService.getByLabOrderId(selectedOrder.id);
      setSelectedResult(updatedResult);
    } catch (err) {
      setDetailError(getFriendlyErrorMessage(err, 'Could not update the lab result.'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Lab Result"
        description="Choose an order, enter the findings, and send the final result to the ordering doctor."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load lab orders</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Work Queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Active orders that still need results.</p>
              </div>
              <Badge variant="secondary">{activeOrders.length} open</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                No lab orders ready for result entry.
              </div>
            ) : (
              activeOrders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleOpenOrder(order.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected ? 'border-teal-400 bg-teal-50 shadow-sm' : 'border-border bg-background hover:border-teal-200 hover:bg-teal-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{order.patientName || order.patientId}</p>
                        <p className="text-xs text-muted-foreground">Ordered by {order.doctorName || order.doctorId}</p>
                      </div>
                      <Badge variant={normalizeUrgency(order.urgency) === 'critical' ? 'destructive' : 'outline'}>
                        {order.urgency}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>{order.tests.join(', ')}</span>
                      <span className="inline-flex items-center gap-1 text-teal-700">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div ref={editorRef} className="scroll-mt-24">
          <Card className="rounded-3xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Result Editor</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Create the lab result and send it to the doctor.</p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedOrder ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={handleCreateResult}
                      disabled={isUpdating || isLoadingDetail}
                    >
                      <FilePlus2 className="mr-2 h-4 w-4" />
                      Create result
                    </Button>
                  ) : null}
                  {isUpdating ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving
                    </span>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingDetail ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              ) : detailError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not load the selected order</AlertTitle>
                  <AlertDescription>{detailError}</AlertDescription>
                </Alert>
              ) : !selectedOrder ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Select a laboratory order to start entering findings.
                </div>
              ) : selectedResult ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900">
                    This result has already been sent to the doctor.
                  </div>
                  <LabResultView order={selectedOrder} result={selectedResult} />
                </div>
              ) : selectedOrder.status === 'pending' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This order is still pending. Start processing before saving the result.
                  </div>
                  <Button className="w-full rounded-2xl" onClick={handleStartProcessing} disabled={isUpdating}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start processing
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FlaskConical className="h-4 w-4 text-teal-700" />
                      {selectedOrder.patientName || selectedOrder.patientId}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedOrder.tests.join(' • ')}
                    </p>
                  </div>
                  <LabResultForm order={selectedOrder} onSubmitted={handleSubmitted} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
