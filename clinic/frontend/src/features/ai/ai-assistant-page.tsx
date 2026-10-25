'use client';

import { Activity, ShieldCheck, Sparkles } from 'lucide-react';
import { AiExecutiveDashboard } from '@/features/ai/ai-executive-dashboard';
import { useAuthStore } from '@/store/auth-store';

/** Executive Forecast & Assistant workspace matching StockFlow BI layout. */
export function AiAssistantPage() {
  const role = useAuthStore((state) => state.user?.role);
  return (
    <main className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-4 w-4" aria-hidden /> CliniCel intelligence
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Forecast &amp; assistant</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Explore appointment activity, projected clinical volume, and ask questions about verified hospital records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role ? (
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground">
              {role.replace(/_/g, ' ')}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Role-secured data
          </span>
        </div>
      </header>

      {/* ── Unified StockFlow-style Executive BI Workspace ───────────────── */}
      <AiExecutiveDashboard />

      <div className="grid gap-4 md:grid-cols-2 pt-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Evidence and freshness</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Forecast figures use real role-scoped appointment history. Each answer cites its source tables and calculation timestamp.
            The displayed baseline is deterministic and does not claim statistical confidence bounds or model accuracy.
          </p>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Human review</h2>
          <p className="mt-1.5 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Clinical documentation is a draft for a qualified clinician to review. Appointment proposals stay pending until confirmed.
          </p>
        </section>
      </div>
    </main>
  );
}
