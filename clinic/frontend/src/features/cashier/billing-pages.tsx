'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Receipt, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import {
  BILLING_KEYS,
  fetchBillingSummary,
  listInvoices,
  listPayments,
  listReceipts,
  recordPayment,
  type Invoice,
  type Payment,
} from '@/services/api/billing';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  ISSUED: 'outline',
  VOID: 'destructive',
};

export function CashierInvoicesPage() {
  const { data, isLoading } = useInvoices();
  const invoices = data?.content ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Every invoice with its balance due." />
      <InvoiceList invoices={invoices} isLoading={isLoading} />
    </div>
  );
}

export function CashierPaymentsPage() {
  const { data: summary, isLoading: summaryLoading } = useSummary();
  const { data, isLoading } = usePayments();
  const payments = data?.content ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Collections and the receipts they produced." />

      <div className="grid gap-4 md:grid-cols-4">
        <MoneyMetric label="Billed" value={summary?.totalBilled ?? 0} loading={summaryLoading} />
        <MoneyMetric label="Collected" value={summary?.totalCollected ?? 0} loading={summaryLoading} />
        <MoneyMetric label="Outstanding" value={summary?.totalOutstanding ?? 0} loading={summaryLoading} />
        <MoneyMetric label="This month" value={summary?.collectedInPeriod ?? 0} loading={summaryLoading} />
      </div>

      <PaymentForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Recent payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function useInvoices() {
  return useQuery({
    queryKey: BILLING_KEYS.invoices(),
    queryFn: () => listInvoices(),
    staleTime: 30_000,
  });
}

function usePayments() {
  return useQuery({
    queryKey: BILLING_KEYS.payments(),
    queryFn: () => listPayments(),
    staleTime: 30_000,
  });
}

function useSummary() {
  return useQuery({
    queryKey: BILLING_KEYS.summary(),
    queryFn: () => fetchBillingSummary(),
    staleTime: 30_000,
  });
}

function MoneyMetric({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="text-3xl">{loading ? '...' : value.toFixed(2)}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InvoiceList({ invoices, isLoading }: { invoices: Invoice[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Invoices
        </CardTitle>
        <CardDescription>Totals are computed on the server from the line items.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.patientName} · {invoice.lines.length} line(s) · issued{' '}
                  {new Date(invoice.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{invoice.total.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">
                  due {invoice.balanceDue.toFixed(2)}
                </span>
                <Badge variant={STATUS_VARIANT[invoice.status] ?? 'outline'}>{invoice.status}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
      <div className="min-w-0">
        <p className="font-medium">{payment.paymentRef}</p>
        <p className="text-sm text-muted-foreground">
          {payment.patientName} · {payment.invoiceNumber} · {new Date(payment.receivedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{payment.method}</Badge>
        <span className="font-semibold">{payment.amount.toFixed(2)}</span>
        {payment.receiptNumber ? (
          <Badge variant="success">{payment.receiptNumber}</Badge>
        ) : (
          <Badge variant="destructive">No receipt</Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Records a payment against an invoice.
 *
 * <p>The amount defaults to the invoice's outstanding balance, because that is
 * what "pay in full" means. The server rejects an overpayment, so an operator
 * cannot accidentally create a negative balance from this form.
 */
function PaymentForm() {
  const queryClient = useQueryClient();
  const { data } = useInvoices();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['method']>('CASH');

  const selected = useMemo(
    () => data?.content.find((invoice) => invoice.id === invoiceId) ?? null,
    [data, invoiceId]
  );

  // Default the amount to the balance as soon as an invoice is picked.
  useEffect(() => {
    if (selected) setAmount(selected.balanceDue.toFixed(2));
  }, [selected]);

  const pay = useMutation({
    mutationFn: () =>
      recordPayment({ invoiceId, amount: Number(amount), method }),
    onSuccess: (payment) => {
      setStatus('success');
      setMessage(
        `Payment ${payment.paymentRef} recorded. Receipt ${
          payment.receiptNumber ?? 'pending'
        } was issued with it.`,
      );
      setInvoiceId('');
      setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That payment could not be recorded.'));
    },
  });

  const outstanding = selected?.balanceDue ?? 0;
  const amountValue = Number(amount);
  const canSubmit =
    invoiceId.length > 0 && amountValue > 0 && (selected ? amountValue <= outstanding : false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4" /> Record a payment
        </CardTitle>
        <CardDescription>
          A receipt is issued in the same request, so a payment can never exist without proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={5000} />
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Select an invoice</option>
            {(data?.content ?? [])
              .filter((invoice) => invoice.balanceDue > 0)
              .map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} — {invoice.patientName} (due {invoice.balanceDue.toFixed(2)})
                </option>
              ))}
          </select>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount"
          />
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as Payment['method'])}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {['CASH', 'CARD', 'MOBILE', 'INSURANCE', 'BANK_TRANSFER'].map((value) => (
              <option key={value} value={value}>
                {value.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            {selected.invoiceNumber}: total {selected.total.toFixed(2)}, paid{' '}
            {selected.amountPaid.toFixed(2)}, outstanding {outstanding.toFixed(2)}.
          </p>
        ) : null}
        <Button disabled={!canSubmit || pay.isPending} onClick={() => pay.mutate()}>
          <Wallet className="h-4 w-4" />
          {pay.isPending ? 'Recording...' : 'Record payment'}
        </Button>
      </CardContent>
    </Card>
  );
}