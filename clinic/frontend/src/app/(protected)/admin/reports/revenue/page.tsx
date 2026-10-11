'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, CreditCard, TrendingUp, Receipt, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { apiClient } from '@/services/api/client';

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  createdAt: string;
}

export default function RevenueReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'invoices', { page: 0, size: 50 }],
    queryFn: async () => {
      const res = await apiClient.get<{ content: Invoice[]; totalElements: number }>('/billing/invoices', {
        params: { page: 0, size: 50 },
      });
      return res.data;
    },
  });

  const invoices = data?.content || [];
  const totalBilled = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount || inv.amount) || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || (inv.status === 'PAID' ? Number(inv.totalAmount || inv.amount) || 0 : 0)), 0);
  const outstanding = Math.max(0, totalBilled - totalPaid);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Billing Report"
        description="Financial aggregates, billed amounts, collected revenue, and outstanding receivables."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Total Billed</CardDescription>
            <CardTitle className="text-3xl font-mono">
              ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{invoices.length} invoices generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Collected Revenue</CardDescription>
            <CardTitle className="text-3xl font-mono text-emerald-600">
              ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Settled payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Outstanding Balance</CardDescription>
            <CardTitle className="text-3xl font-mono text-amber-600">
              ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Pending patient settlement</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Invoice Transactions</CardTitle>
          <CardDescription>Direct invoice ledger records from database.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices found in database.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.slice(0, 15).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.patientName || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      ${Number(inv.totalAmount || inv.amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'PAID' ? 'default' : 'secondary'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
