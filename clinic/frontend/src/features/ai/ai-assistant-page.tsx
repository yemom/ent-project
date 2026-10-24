'use client';

import { AiForecastCard, AiAssistantPanel } from '@/features/ai/ai-assistant-panel';
import { useAuthStore } from '@/store/auth-store';

/**
 * The dedicated assistant screen.
 *
 * <p>The same panel is embedded in the role dashboards; this page is for the longer
 * working session, where the conversation has room to run. Capabilities are
 * decided by the server, so this page looks the same for every role apart from
 * what it can actually ask about.
 *
 * <p>The three notes below are stated rather than hidden, because a user who does
 * not know the limits of an assistant will act on a confident wrong answer.
 */
export function AiAssistantPage() {
  const role = useAuthStore((state) => state.user?.role);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Clinic / Assistant</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence-grounded support for {role ? role.replace(/_/g, ' ').toLowerCase() : 'your account'}.
            Clinical drafts are never diagnoses and always require clinician review.
          </p>
        </div>
        <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Read-only
        </span>
      </div>

      <AiForecastCard />

      <div className="grid min-h-[34rem] gap-5 lg:grid-cols-[10rem_1fr]">
        <aside className="rounded-xl border border-border bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversations
          </p>
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium">
            Current session
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Ask about the role-scoped forecast and operational records.
          </p>
        </aside>
        <AiAssistantPanel className="min-h-[34rem]" />
      </div>

      <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="font-medium text-foreground">Live figures</h2>
          <p className="mt-1">Counts and balances are calculated from stored records and show their source period.</p>
        </section>
        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="font-medium text-foreground">Suggested actions</h2>
          <p className="mt-1">Forecast suggestions become questions you can send directly to the assistant.</p>
        </section>
        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="font-medium text-foreground">Human review</h2>
          <p className="mt-1">Clinical documentation is a draft only. Verify every claim against the source record before signing.</p>
        </section>
      </div>
    </div>
  );
}