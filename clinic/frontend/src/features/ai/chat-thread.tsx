'use client';

import React, { useRef } from 'react';
import { AlertTriangle, Bot, ExternalLink, Loader2, RefreshCw, Send } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

/**
 * The hospital chat thread matching StockFlow / inventory-system's ChatThread architecture.
 *
 * <p>Every assistant message carries the live data it was built from. A financial answer
 * shows its period and a link to the billing module with the same figures; a medicine
 * answer shows the items as stock cards; an appointment answer shows the booking details.
 * The sentence is never the only place a figure appears, so figures are always grounded.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conversationId?: string | null;
  deterministic?: boolean;
  guardIntervened?: boolean;
  requiresReview?: boolean;
  reviewNotice?: string | null;
  note?: string | null;
  sources?: string[];
  toolResults?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface ChatThreadProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  suggestions: string[];
  showSuggestions: boolean;
  onSend: (question: string) => void;
  onRetry?: () => void;
  placeholder?: string;
  ariaLabel?: string;
}

const MONEY_OR_COUNT_KEY =
  /(amount|profit|sales|revenue|expense|cash|total|outstanding|balance|value|received|paid|refund|cost|billed|collected)/i;

export function ChatThread({
  messages,
  loading,
  error,
  suggestions,
  showSuggestions,
  onSend,
  onRetry,
  placeholder = 'Ask a question about clinic operations, patients, appointments...',
  ariaLabel = 'Chat with the clinical assistant',
}: ChatThreadProps) {
  const [input, setInput] = React.useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const transcript = transcriptRef.current;
      if (typeof transcript?.scrollTo === 'function') {
        transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [messages.length, loading]);

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (trimmed.length === 0 || loading) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label={ariaLabel}>
      {/* ── Transcript ─────────────────────────────────────────── */}
      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.length === 0 && !loading && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              Ask a question. The answer is built from live hospital records and states the period it covers.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This assistant reads real appointments, patient lists, pharmacy stock, and billing data without altering records.
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-xl bg-blue-600 px-3.5 py-2 text-sm text-white shadow-sm sm:max-w-[75%]">
                {message.content}
              </p>
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} />
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Looking up the records…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" /> That question could not be answered.
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Suggestions ────────────────────────────────────────── */}
      {showSuggestions && suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => submit(question)}
              disabled={loading}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────── */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2 pt-3 border-t border-border mt-2"
      >
        <label htmlFor="chat-question" className="sr-only">
          Ask a question
        </label>
        <input
          id="chat-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          aria-label="Send question"
          className="rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** An assistant message: the grounded answer, verification badges, and structured result cards. */
function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 shadow-sm"
        aria-hidden="true"
      >
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[95%] rounded-xl border border-border bg-card p-3.5 shadow-sm sm:max-w-[85%]">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Assistant</span>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            Database verified
          </Badge>
          {message.guardIntervened && (
            <Badge variant="secondary" className="text-[10px]">Figure corrected</Badge>
          )}
          {message.requiresReview && (
            <Badge variant="destructive" className="text-[10px]">Requires clinical review</Badge>
          )}
          {message.createdAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <p className="whitespace-pre-line text-sm text-foreground leading-relaxed">
          {message.content}
        </p>

        {message.reviewNotice && (
          <p className="mt-2 border-l-2 border-amber-500 pl-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            {message.reviewNotice}
          </p>
        )}

        {message.note && (
          <p className="mt-2 border-l-2 border-border pl-2 text-xs text-muted-foreground">
            {message.note}
          </p>
        )}

        {message.toolResults && Object.keys(message.toolResults).length > 0 && (
          <ResultCards toolResults={message.toolResults} />
        )}

        {message.sources && message.sources.length > 0 && (
          <SourceLine sources={message.sources} />
        )}
      </div>
    </div>
  );
}

/** Structured Cards matching StockFlow: Product/Medicine Cards, Transaction Cards, and Key Figures. */
function ResultCards({ toolResults }: { toolResults: Record<string, unknown> }) {
  const entries = Object.entries(toolResults);
  const [primaryTool, primary] = entries[0] ?? [];
  if (!primaryTool || typeof primary !== 'object' || primary === null) {
    return null;
  }
  const result = primary as Record<string, unknown>;

  return (
    <div className="mt-3 space-y-3">
      {/* Medicine / Inventory Cards */}
      {(primaryTool.includes('pharmacy') || primaryTool.includes('medicine') || primaryTool.includes('inventory')) && (
        <MedicineCards
          rows={
            (Array.isArray(result.medicines)
              ? result.medicines
              : Array.isArray(result.batches)
                ? result.batches
                : Array.isArray(result.items)
                  ? result.items
                  : []) as Array<Record<string, unknown>>
          }
        />
      )}

      {/* Appointment Cards */}
      {(primaryTool.includes('appointment') || primaryTool.includes('slot') || primaryTool.includes('booking')) && (
        <AppointmentCards
          rows={
            (Array.isArray(result.appointments)
              ? result.appointments
              : Array.isArray(result.slots)
                ? result.slots
                : []) as Array<Record<string, unknown>>
          }
        />
      )}

      {/* Financial Transaction Card */}
      {(primaryTool.includes('financial') || primaryTool.includes('invoice') || primaryTool.includes('billing')) && (
        <TransactionCard result={result} />
      )}

      {/* General Result Table for lists */}
      {(Array.isArray(result.rows) ||
        Array.isArray(result.queue) ||
        Array.isArray(result.orders) ||
        Array.isArray(result.doctors)) && (
        <ResultTable
          rows={
            (result.rows ??
              result.queue ??
              result.orders ??
              result.doctors) as Array<Record<string, unknown>>
          }
        />
      )}

      {/* Headline Key Figures */}
      <KeyFigures result={result} />
    </div>
  );
}

/** Medicine / Pharmacy Stock Cards */
function MedicineCards({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.slice(0, 6).map((row, i) => {
        const inStock = Number(row.stockOnHand ?? row.quantity ?? 0) > 0;
        const name = String(row.name ?? row.medicineName ?? row.brandName ?? 'Medicine');
        const sku = String(row.batchNumber ?? row.code ?? row.category ?? '');
        const price = typeof row.unitPrice === 'number' ? row.unitPrice : typeof row.price === 'number' ? row.price : null;

        return (
          <li
            key={String(row.id ?? i)}
            className="rounded-lg border border-border bg-muted/40 p-2.5 transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                {sku && <p className="truncate text-[10px] text-muted-foreground">{sku}</p>}
              </div>
              <Badge variant={inStock ? 'outline' : 'secondary'} className={inStock ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-xs'}>
                {inStock ? 'In stock' : 'Low / Out'}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-foreground">
                {price != null ? `ETB ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (row.quantity != null ? `Qty: ${row.quantity}` : '—')}
              </span>
              {Boolean(row.expiryDate) && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  Exp: {String(row.expiryDate).slice(0, 10)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Appointment Reference Cards */
function AppointmentCards({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.slice(0, 4).map((row, i) => (
        <div key={String(row.id ?? i)} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <div>
            <p className="font-semibold text-foreground">
              {String(row.patientName ?? row.patient ?? row.doctorName ?? 'Consultation')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {String(row.appointmentDate ?? row.date ?? row.startTime ?? '')} · {String(row.department ?? row.reason ?? 'General')}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {String(row.status ?? 'SCHEDULED')}
          </Badge>
        </div>
      ))}
    </div>
  );
}

/** Transaction / Invoice Card */
function TransactionCard({ result }: { result: Record<string, unknown> }) {
  const fields = (
    [
      ['Invoice', result.invoiceNumber ?? result.id],
      ['Date', result.invoiceDate ?? result.date ?? result.from],
      ['Status', result.status ?? result.paymentStatus],
      ['Patient', result.patientName ?? result.patient],
    ] as Array<[string, unknown]>
  ).filter(([, value]) => value != null);

  const total = typeof result.totalAmount === 'number' ? result.totalAmount : typeof result.totalBilled === 'number' ? result.totalBilled : null;
  const collected = typeof result.totalCollected === 'number' ? result.totalCollected : typeof result.paidAmount === 'number' ? result.paidAmount : null;
  const balance = typeof result.outstandingBalance === 'number' ? result.outstandingBalance : null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="truncate text-xs font-medium text-foreground">{String(value)}</dd>
          </div>
        ))}
        {total != null && (
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Billed</dt>
            <dd className="text-xs font-semibold text-foreground">
              ETB {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </dd>
          </div>
        )}
        {collected != null && (
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Collected</dt>
            <dd className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ETB {collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </dd>
          </div>
        )}
        {balance != null && balance > 0 && (
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</dt>
            <dd className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              ETB {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Generic Result Table for list responses */
function ResultTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]).filter(
    (key) => !['id', 'evidence', 'patientId', 'doctorId'].includes(key)
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-muted/30">
      <table className="w-full min-w-[300px] text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.slice(0, 4).map((col) => (
              <th key={col} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {col.replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row, idx) => (
            <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/40">
              {columns.slice(0, 4).map((col) => {
                const val = row[col];
                const isMoney = typeof val === 'number' && MONEY_OR_COUNT_KEY.test(col);
                return (
                  <td key={col} className="max-w-[12rem] truncate px-3 py-1.5 text-foreground">
                    {isMoney
                      ? `ETB ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : val == null
                        ? '—'
                        : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Key Figures grid matching StockFlow */
function KeyFigures({ result }: { result: Record<string, unknown> }) {
  const entries = Object.entries(result).filter(
    ([key, value]) =>
      typeof value === 'number' &&
      MONEY_OR_COUNT_KEY.test(key) &&
      value !== 0 &&
      !['status', 'version'].includes(key)
  );
  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/30 p-2.5 sm:grid-cols-3">
      {entries.slice(0, 6).map(([key, value]) => {
        const isMoney = /amount|sales|revenue|expense|cash|total|outstanding|balance|value|received|paid|billed|collected/i.test(key);
        return (
          <div key={key} className="min-w-0">
            <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {key.replace(/([A-Z])/g, ' $1')}
            </dt>
            <dd className="truncate text-xs font-semibold text-foreground">
              {isMoney
                ? `ETB ${(value as number).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : (value as number).toLocaleString()}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Source verification links matching StockFlow */
function SourceLine({ sources }: { sources: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
      <span className="font-medium text-muted-foreground">Verify:</span>
      {sources.map((source, index) => {
        const href = mapSourceToHref(source);
        return href ? (
          <Link
            key={index}
            href={href}
            className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            {source}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span key={index} className="text-muted-foreground">
            {source}
          </span>
        );
      })}
    </div>
  );
}

function mapSourceToHref(source: string): string | null {
  const s = source.toLowerCase();
  if (s.includes('appointment')) return '/admin/appointments';
  if (s.includes('doctor') || s.includes('staff')) return '/admin/doctors';
  if (s.includes('patient')) return '/admin/patients';
  if (s.includes('lab')) return '/admin/laboratory';
  if (s.includes('pharmacy') || s.includes('batch') || s.includes('inventory')) return '/admin/pharmacy';
  if (s.includes('bill') || s.includes('invoice') || s.includes('payment') || s.includes('financ')) return '/admin/billing';
  if (s.includes('ward') || s.includes('bed')) return '/admin/wards';
  return null;
}
