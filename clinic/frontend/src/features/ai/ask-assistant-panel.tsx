'use client';

import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';
import {
  askAiAssistant,
  getAiCapabilities,
  type AiChatResponse,
} from '@/services/api/ai';

export interface AskAssistantPanelProps {
  range?: { from: string; to: string };
  className?: string;
}

interface Exchange {
  question: string;
  answer: AiChatResponse;
}

const DEFAULT_SUGGESTIONS = [
  { label: 'How many appointments were booked & completed?', capability: 'appointment_metrics' },
  { label: 'Which doctors have the highest workload?', capability: 'staff_workload' },
  { label: 'What is the bed occupancy in wards?', capability: 'operational_forecast' },
  { label: 'Show pending and in-progress laboratory orders.', capability: 'laboratory_workload' },
  { label: 'Which medicines are low on stock or expiring soon?', capability: 'pharmacy_inventory' },
  { label: 'What is the total revenue and outstanding balance?', capability: 'financial_summary' },
];

export function AskAssistantPanel({ range, className }: AskAssistantPanelProps) {
  const role = useAuthStore((state) => state.user?.role);
  const [input, setInput] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: getAiCapabilities,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const availableCaps = capabilities.data?.capabilities ?? [];

  const ask = useMutation({
    mutationFn: async ({ question, capabilityId }: { question: string; capabilityId: string }) => {
      const activeConversationId = exchanges[exchanges.length - 1]?.answer.conversationId ?? null;
      return askAiAssistant({
        capabilityId,
        message: question,
        conversationId: activeConversationId,
        arguments: range ? { from: range.from, to: range.to } : undefined,
      });
    },
    onSuccess: (answer, { question }) => {
      setExchanges((previous) => [...previous, { question, answer }]);
      setInput('');
      window.setTimeout(() => {
        const transcript = transcriptRef.current;
        if (typeof transcript?.scrollTo === 'function') {
          transcript.scrollTo({
            top: transcript.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 50);
    },
  });

  const inferCapability = (questionText: string): string => {
    const lower = questionText.toLowerCase();
    if (lower.includes('doctor') || lower.includes('workload') || lower.includes('staff')) {
      return availableCaps.some((c) => c.id === 'staff_workload') ? 'staff_workload' : 'appointment_metrics';
    }
    if (lower.includes('lab') || lower.includes('test') || lower.includes('specimen')) {
      return availableCaps.some((c) => c.id === 'laboratory_workload') ? 'laboratory_workload' : 'operational_forecast';
    }
    if (lower.includes('medicine') || lower.includes('stock') || lower.includes('pharmacy') || lower.includes('expir')) {
      return availableCaps.some((c) => c.id === 'pharmacy_inventory') ? 'pharmacy_inventory' : 'operational_forecast';
    }
    if (lower.includes('revenue') || lower.includes('bill') || lower.includes('balance') || lower.includes('pay') || lower.includes('invoice')) {
      return availableCaps.some((c) => c.id === 'financial_summary') ? 'financial_summary' : 'operational_forecast';
    }
    if (lower.includes('patient') || lower.includes('register')) {
      return availableCaps.some((c) => c.id === 'patient_registrations') ? 'patient_registrations' : 'appointment_metrics';
    }
    if (lower.includes('slot') || lower.includes('availab')) {
      return availableCaps.some((c) => c.id === 'available_slots') ? 'available_slots' : 'appointment_metrics';
    }
    // Default to appointment metrics or first available
    return availableCaps.find((c) => c.id === 'appointment_metrics')?.id ??
           availableCaps.find((c) => c.id === 'operational_forecast')?.id ??
           availableCaps[0]?.id ??
           'appointment_metrics';
  };

  const submit = (question: string, explicitCapability?: string) => {
    const trimmed = question.trim();
    if (trimmed.length === 0 || ask.isPending) return;
    const capabilityId = explicitCapability || inferCapability(trimmed);
    ask.mutate({ question: trimmed, capabilityId });
  };

  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <Card className={`flex h-full flex-col justify-between border border-border bg-card shadow-sm ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Bot className="h-4 w-4 text-blue-500" />
            {isSuperAdmin ? 'Ask about the hospital' : 'Ask about the clinic'}
          </h3>
          <span className="text-xs text-muted-foreground">Read-only</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Answers are computed from your recorded clinical and administrative data and always state the period they cover. This assistant cannot change records, prescribe medication, or post transactions.
        </p>

        {/* ── Transcript ─────────────────────────────────────────────────── */}
        <div
          ref={transcriptRef}
          className="max-h-[360px] min-h-[220px] flex-1 space-y-3 overflow-y-auto pr-1"
          aria-live="polite"
        >
          {exchanges.length === 0 && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">
                Ask a question and the answer will show the figures it used.
              </p>
              {range ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Your dashboard filter ({range.from} to {range.to}) will be applied unless the question names a different period.
                </p>
              ) : null}
            </div>
          )}

          {exchanges.map((exchange, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-sm">
                  {exchange.question}
                </p>
              </div>
              <AnswerBlock answer={exchange.answer} range={range} />
            </div>
          ))}

          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Looking…
            </div>
          )}

          {ask.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                That question could not be answered.
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                Ensure this account holds the required clinical or reporting permissions.
              </p>
            </div>
          )}
        </div>

        {/* ── Suggestions Pills matching StockFlow ────────────────────────── */}
        {exchanges.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {DEFAULT_SUGGESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => submit(item.label, item.capability)}
                disabled={ask.isPending}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar matching StockFlow ───────────────────────────────── */}
        <div className="space-y-2 pt-2 border-t border-border">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about appointments, patients, wards or doctors…"
              disabled={ask.isPending}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={ask.isPending || input.trim().length === 0}
              aria-label="Send question"
              className="rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {availableCaps.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground transition hover:text-foreground">
                What this can answer
              </summary>
              <ul className="mt-2 space-y-1 pl-4 list-disc text-muted-foreground">
                {availableCaps.map((c) => (
                  <li key={c.id}>
                    <strong>{c.label}:</strong> {c.description}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerBlock({ answer, range }: { answer: AiChatResponse; range?: { from: string; to: string } }) {
  const sources = answer.sources ?? [];

  return (
    <div className="max-w-[95%] rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Answered from database
        </Badge>
        {range ? (
          <span className="text-xs text-muted-foreground">
            Filter: {range.from} – {range.to}
          </span>
        ) : null}
      </div>

      <p className="whitespace-pre-line text-sm text-foreground leading-relaxed">
        {answer.answer}
      </p>

      {answer.reviewNotice ? (
        <p className="mt-2 border-l-2 border-amber-400 pl-2 text-xs text-amber-800 dark:text-amber-300">
          {answer.reviewNotice}
        </p>
      ) : null}

      {sources.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground font-medium">Verify:</span>
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
      ) : null}
    </div>
  );
}

function mapSourceToHref(source: string): string | null {
  const s = source.toLowerCase();
  if (s.includes('appointment')) return '/admin/appointments';
  if (s.includes('doctor') || s.includes('staff')) return '/admin/doctors';
  if (s.includes('patient')) return '/admin/patients';
  if (s.includes('lab')) return '/admin/laboratory';
  if (s.includes('pharmacy') || s.includes('batch')) return '/admin/pharmacy';
  if (s.includes('bill') || s.includes('invoice') || s.includes('payment')) return '/admin/billing';
  if (s.includes('ward') || s.includes('room') || s.includes('bed')) return '/admin/wards';
  return null;
}
