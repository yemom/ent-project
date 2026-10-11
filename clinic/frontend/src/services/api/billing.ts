import { apiClient } from '@/services/api/client';
import type { PageResponse } from '@/types/api';

/**
 * Invoices, payments and receipts.
 *
 * <p>The server computes invoice totals from the line items and rejects any
 * payment larger than the outstanding balance, so the client never sends a
 * total and never has to reconcile one.
 */

export interface InvoiceLine {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  issuedAt: string;
  dueAt?: string | null;
  lines: InvoiceLine[];
}

export interface Payment {
  id: string;
  paymentRef: string;
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'MOBILE' | 'INSURANCE' | 'BANK_TRANSFER';
  status: 'COMPLETED' | 'FAILED' | 'REVERSED';
  receivedById?: string | null;
  notes?: string | null;
  receivedAt: string;
  receiptId?: string | null;
  receiptNumber?: string | null;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  issuedById?: string | null;
  issuedAt: string;
}

export interface BillingSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectedInPeriod: number;
}

export interface InvoiceLinePayload {
  description: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoicePayload {
  patientId: string;
  appointmentId?: string;
  discount?: number;
  tax?: number;
  dueAt?: string;
  notes?: string;
  lines: InvoiceLinePayload[];
}

export const BILLING_KEYS = {
  invoices: (status?: string) => ['billing', 'invoices', status ?? 'all'] as const,
  invoice: (id: string) => ['billing', 'invoice', id] as const,
  payments: (invoiceId?: string) => ['billing', 'payments', invoiceId ?? 'all'] as const,
  receipts: (invoiceId?: string) => ['billing', 'receipts', invoiceId ?? 'all'] as const,
  summary: () => ['billing', 'summary'] as const,
};

export async function listInvoices(params: { status?: string; patientId?: string } = {}) {
  const { data } = await apiClient.get<PageResponse<Invoice>>('/billing/invoices', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await apiClient.get<Invoice>(`/billing/invoices/${id}`);
  return data;
}

export async function createInvoice(payload: InvoicePayload): Promise<Invoice> {
  const { data } = await apiClient.post<Invoice>('/billing/invoices', payload);
  return data;
}

export async function recordPayment(payload: {
  invoiceId: string;
  amount: number;
  method: Payment['method'];
  reference?: string;
  notes?: string;
}): Promise<Payment> {
  const { data } = await apiClient.post<Payment>('/billing/payments', payload);
  return data;
}

export async function listPayments(params: { invoiceId?: string } = {}) {
  const { data } = await apiClient.get<PageResponse<Payment>>('/billing/payments', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function listReceipts(params: { invoiceId?: string } = {}) {
  const { data } = await apiClient.get<PageResponse<Receipt>>('/billing/receipts', {
    params: { page: 0, size: 50, ...params },
  });
  return data;
}

export async function getReceipt(id: string): Promise<Receipt> {
  const { data } = await apiClient.get<Receipt>(`/billing/receipts/${id}`);
  return data;
}

export async function fetchBillingSummary(params: { from?: string; to?: string } = {}) {
  const { data } = await apiClient.get<BillingSummary>('/billing/summary', {
    params: { from: params.from, to: params.to },
  });
  return data;
}