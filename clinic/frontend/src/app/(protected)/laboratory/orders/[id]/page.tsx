'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';
import { LabResultForm } from '@/features/laboratory/components/lab-result-form';
import { LabResultView } from '@/features/laboratory/components/lab-result-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { LAB_ROUTES } from '@/lib/constants';
import { ArrowLeft, Beaker, CheckCircle2, ClipboardList, Clock, FlaskConical, AlertCircle } from 'lucide-react';
import type { LabOrder, LabResult } from '@/features/laboratory/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function OrderDetailsPage({ params }: Props) {
  // Unwrap params using React.use()
  const { id } = React.use(params);

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrderAndResults = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const orderData = await labOrdersService.get(id);
      setOrder(orderData);

      if (orderData.status === 'completed') {
        const resultData = await labResultsService.getByLabOrderId(id);
        setResult(resultData);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to retrieve investigation order details. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndResults();
  }, [id]);

  const handleStartProcessing = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      await labOrdersService.updateStatus(order.id, 'IN_PROGRESS');
      await fetchOrderAndResults();
    } catch (err) {
      setError('Could not update status. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const u = String(urgency).toLowerCase();
    if (u === 'critical') return <Badge variant="destructive" className="rounded-xl px-3 py-1 font-semibold">Critical</Badge>;
    if (u === 'urgent') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none rounded-xl px-3 py-1 font-semibold">Urgent</Badge>;
    return <Badge variant="outline" className="rounded-xl px-3 py-1 font-medium">Routine</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'completed') return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 py-1 font-semibold">Completed</Badge>;
    if (s === 'in_progress') return <Badge className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-3 py-1 font-semibold animate-pulse">In Progress</Badge>;
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-3 py-1 font-semibold">Pending</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4">
        <Skeleton className="h-10 w-[200px] rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="col-span-2 h-[400px] rounded-3xl" />
          <Skeleton className="col-span-1 h-[400px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Alert variant="destructive" className="rounded-2xl border-red-200">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">Investigation Error</AlertTitle>
          <AlertDescription className="mt-1">{error || 'The requested lab order could not be loaded.'}</AlertDescription>
        </Alert>
        <Link href={LAB_ROUTES.laboratoryOrders}>
          <Button className="rounded-xl bg-teal-800 hover:bg-teal-900 text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 pb-12">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link href={LAB_ROUTES.laboratoryOrders} className="inline-flex items-center text-sm font-semibold text-teal-800 hover:text-teal-900 gap-1.5 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <Badge variant="outline" className="border-teal-100 text-teal-800 bg-teal-50/50 rounded-xl px-3 py-1 text-xs">
          Order UID: {order.id.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Order Specification Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-white border-b border-slate-100/50 py-5 px-6">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-teal-800" />
                <CardTitle className="text-lg">Lab Investigation Order Details</CardTitle>
              </div>
              <CardDescription>Review the specified tests and provider-furnished clinical context.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-100">
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Patient</p>
                  <p className="font-semibold text-slate-900 text-base">{order.patientName || 'Unknown Patient'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">UID: {order.patientId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Ordering Physician</p>
                  <p className="font-semibold text-slate-900 text-base">{order.doctorName || 'Dr. Practitioner'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">UID: {order.doctorId}</p>
                </div>
              </div>

              <div className="pb-6 border-b border-slate-100">
                <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-2">Requested Diagnostic Tests</p>
                <div className="flex flex-wrap gap-2">
                  {order.tests.map((test) => (
                    <span 
                      key={test} 
                      className="inline-flex items-center rounded-xl bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 border border-teal-100/50"
                    >
                      <Beaker className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                      {test}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-2">Clinical Indication & Notes</p>
                <div className="rounded-2xl bg-slate-50 border border-slate-100/60 p-4 text-sm text-slate-700 italic leading-relaxed">
                  "{order.clinicalNotes || 'No specific clinical notes provided by the ordering physician.'}"
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Execution & Actions */}
        <div className="col-span-1 space-y-6">
          
          {/* Status Overview Card */}
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader className="py-5 px-6 border-b border-slate-50 bg-slate-50/20">
              <CardTitle className="text-base font-bold">Execution Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 font-medium">Priority Tier:</span>
                {getUrgencyBadge(order.urgency)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 font-medium">Current Status:</span>
                {getStatusBadge(order.status)}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400 font-medium">
                <span>Received:</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions & Result Input Panel */}
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="py-5 px-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <CardTitle className="text-base font-bold">Diagnostic Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              
              {/* PENDING State */}
              {order.status === 'pending' && (
                <div className="space-y-4 text-center py-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto shadow-sm">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">Awaiting Collection & Analysis</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-[220px] mx-auto leading-relaxed">
                      Confirm you have gathered and prepped the specimen before starting analysis.
                    </p>
                  </div>
                  <Button
                    onClick={handleStartProcessing}
                    disabled={isProcessing}
                    className="w-full rounded-2xl bg-teal-800 hover:bg-teal-900 text-white h-11 shadow-sm font-semibold transition-colors mt-2"
                  >
                    {isProcessing ? 'Initializing...' : 'Start Specimen Processing'}
                  </Button>
                </div>
              )}

              {/* IN_PROGRESS State */}
              {order.status === 'in_progress' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">Record Findings Below</span>
                  </div>
                  <LabResultForm order={order} onSubmitted={fetchOrderAndResults} />
                </div>
              )}

              {/* COMPLETED State */}
              {order.status === 'completed' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Released Findings</span>
                  </div>
                  <LabResultView order={order} result={result || undefined} />
                </div>
              )}

            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
