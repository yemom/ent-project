'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BadgeDollarSign, Receipt, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { apiClient } from '@/services/api/client';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

export interface RefundRequest {
  id: string;
  invoiceId: string;
  amount: number;
  requiresApproval: boolean;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  requestedByEmail: string | null;
  approvedByEmail: string | null;
  reason: string;
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

interface RefundPage {
  content: RefundRequest[];
  totalElements: number;
}

export const CASHIER_REFUNDS_KEY = ['billing', 'refunds'] as const;

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  APPROVED: 'success',
  COMPLETED: 'success',
  PENDING_APPROVAL: 'warning',
  REJECTED: 'destructive',
};

/**
 * Cashier workspace: refunds only.
 *
 * <p>A cashier can request a refund. Anything above the server-configured
 * threshold is held for a second privileged approver, so the UI says so
 * explicitly rather than implying the money has moved.
 */
export function useRefunds() {
  return useQuery({
    queryKey: CASHIER_REFUNDS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<RefundPage>('/billing/refunds', {
        params: { page: 0, size: 25 },
      });
      return data;
    },
  });
}

export function CashierDashboardPage() {
  const { data, isLoading } = useRefunds();
  const refunds = data?.content ?? [];
  const pending = refunds.filter((refund) => refund.status === 'PENDING_APPROVAL').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Cashier" description="Refunds requiring a decision." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">Refunds</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '...' : refunds.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">Awaiting approval</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '...' : pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">Approved</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading
                ? '...'
                : refunds.filter((refund) => refund.status === 'APPROVED').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <RefundRequestForm />
      <RefundList refunds={refunds} isLoading={isLoading} />
    </div>
  );
}

export function CashierRefundsPage() {
  const { data, isLoading } = useRefunds();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="Refunds above the approval threshold need a second privileged approver."
      />
      <RefundRequestForm />
      <RefundList refunds={data?.content ?? []} isLoading={isLoading} />
    </div>
  );
}

function RefundRequestForm() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ invoiceId: '', amount: '', reason: '' });

  const requestRefund = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<RefundRequest>('/billing/refunds', {
        invoiceId: form.invoiceId.trim(),
        amount: Number(form.amount),
        reason: form.reason.trim(),
      });
      return data;
    },
    onSuccess: (refund) => {
      setStatus('success');
      setMessage(
        refund.requiresApproval
          ? `Refund of ${refund.amount} submitted. It needs approval by a second authorised user.`
          : `Refund of ${refund.amount} approved.`
      );
      setForm({ invoiceId: '', amount: '', reason: '' });
      void queryClient.invalidateQueries({ queryKey: CASHIER_REFUNDS_KEY });
    },
    onError: (err) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(err, 'We could not submit that refund.'));
    },
  });

  const canSubmit = form.invoiceId.trim().length > 0 && Number(form.amount) > 0 && form.reason.trim().length >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4" /> Request a refund
        </CardTitle>
        <CardDescription>Amounts above the threshold are held for approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={form.invoiceId}
            onChange={(event) => setForm({ ...form, invoiceId: event.target.value })}
            placeholder="Invoice ID"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="Amount"
          />
          <Input
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="Reason (required)"
          />
        </div>
        <Button disabled={!canSubmit || requestRefund.isPending} onClick={() => requestRefund.mutate()}>
          <Wallet className="h-4 w-4" />
          {requestRefund.isPending ? 'Submitting...' : 'Submit refund request'}
        </Button>
      </CardContent>
    </Card>
  );
}

function RefundList({ refunds, isLoading }: { refunds: RefundRequest[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Recent refunds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </>
        ) : refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refunds recorded.</p>
        ) : (
          refunds.map((refund) => (
            <div
              key={refund.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 p-4"
            >
              <div>
                <p className="font-medium">Invoice {refund.invoiceId}</p>
                <p className="text-sm text-muted-foreground">{refund.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{refund.amount}</span>
                <Badge variant={STATUS_VARIANT[refund.status] ?? 'outline'}>{refund.status}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}