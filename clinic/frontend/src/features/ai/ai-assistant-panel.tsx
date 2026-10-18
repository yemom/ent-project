'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth-store';
import {
  aiErrorMessage,
  askAiAssistant,
  confirmAiAction,
  getAiCapabilities,
  getAiForecast,
  rejectAiAction,
  type AiChatResponse,
} from '@/services/api/ai';

/**
 * The role-aware assistant panel.
 *
 * <p>One component serves every role. What it can do is decided by the server and
 * arrives in {@link getAiCapabilities}; this file has no role branches, so a new
 * role gets the assistant the moment the backend grants it a capability, and a
 * permission change takes effect without a frontend release.
 *
 * <h2>What this deliberately does not do</h2>
 *
 * <ul>
 *   <li><b>It does not choose data.</b> The user picks a capability, the server
 *       re-checks the permission and computes the facts. There is no free-text
 *       tool selection for a prompt to hijack.</li>
 *   <li><b>It does not render HTML.</b> Answers are text. A model that emits markup
 *       shows markup, not a rendered page.</li>
 *   <li><b>It does not hide the evidence.</b> Every answer carries its sources and
 *       the time the numbers were computed, so a generated statement is
 *       distinguishable from a measured one.</li>
 * </ul>
 *
 * <p>State-changing work goes through a proposal card with explicit Confirm and
 * Discard buttons. Nothing is applied by the act of asking.
 */
export function AiAssistantPanel({
  className,
  compact = false,
  contextArguments,
}: {
  className?: string;
  /** Tighter layout for embedding in a dashboard column. */
  compact?: boolean;
  /** Server-validated context such as the currently open patient. */
  contextArguments?: Record<string, string | number | undefined>;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: getAiCapabilities,
    staleTime: 5 * 60_000,
  });
  const forecast = useQuery({
    queryKey: ['ai', 'forecast'],
    queryFn: getAiForecast,
    // Forecast access is role-scoped by the backend. Wait for the capability
    // response before requesting it so roles without forecast access do not
    // generate avoidable 403 responses on every dashboard.
    enabled:
      capabilities.isSuccess &&
      capabilities.data.capabilities.some(
        (capability) => capability.id === 'operational_forecast'
      ),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const [capabilityId, setCapabilityId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<AiChatResponse[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    id: string;
    description: string;
  } | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);

  const conversationId = turns[turns.length - 1]?.conversationId ?? null;
  const lastTurn = turns[turns.length - 1];

  /**
   * Guards against a double submission.
   *
   * The disabled attribute alone is not enough: a rapid double click can fire the
   * handler twice before React re-renders with `disabled`, which would bill two
   * generations and post two questions.
   */
  const inFlight = useRef(false);

  const ask = useCallback(
    async (question: string, capability: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setIsPending(true);
      setError(null);
      setProposal(null);
      setProposalMessage(null);
      try {
        const response = await askAiAssistant({
          capabilityId: capability,
          message: question,
          conversationId,
          arguments: contextArguments,
        });
        setTurns((previous) => [...previous, response]);
      } catch (err) {
        setError(aiErrorMessage(err));
      } finally {
        inFlight.current = false;
        setIsPending(false);
      }
    },
    [conversationId, contextArguments]
  );

  const resolveProposal = useCallback(
    async (id: string, accept: boolean) => {
      setProposalBusy(true);
      setProposalMessage(null);
      try {
        const result = accept
          ? await confirmAiAction(id)
          : (await rejectAiAction(id), { resultMessage: 'Discarded.' });
        setProposalMessage(result.resultMessage ?? (accept ? 'Applied.' : 'Discarded.'));
        if (accept) setProposal(null);
      } catch (err) {
        setProposalMessage(aiErrorMessage(err));
      } finally {
        setProposalBusy(false);
      }
    },
    []
  );

  const available = capabilities.data?.capabilities ?? [];
  const selected = useMemo(
    () => available.find((capability) => capability.id === capabilityId) ?? available[0],
    [available, capabilityId]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !message.trim() || isPending) return;
    const question = message.trim();
    setMessage('');
    void ask(question, selected.id);
  };

  // ------------------------------------------------------------------
  // Unavailable
  // ------------------------------------------------------------------

  if (capabilities.isError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" aria-hidden />
            Assistant
            {role ? <RoleBadge role={role} /> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{aiErrorMessage(capabilities.error)}</CardContent>
      </Card>
    );
  }

  if (capabilities.data && !capabilities.data.available) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" aria-hidden />
            Assistant
            {role ? <RoleBadge role={role} /> : null}
          </CardTitle>
          <CardDescription>Not enabled on this deployment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {capabilities.data.unavailableReason ??
            'The assistant is not available right now. Everything else on this page works as usual.'}
          <ForecastSummary data={forecast.data} loading={forecast.isLoading} />
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Available
  // ------------------------------------------------------------------

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" aria-hidden />
          Assistant
        </CardTitle>
        <CardDescription>
          Answers come from records you are authorised to read. Figures are calculated by the
          system, not estimated.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ForecastSummary
          data={forecast.data}
          loading={forecast.isLoading}
          onSuggestion={(question) => void ask(question, 'operational_forecast')}
        />
        {capabilities.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading what you can ask about…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There is nothing for the assistant to answer with your current access.
          </p>
        ) : (
          <>
            {available.some((capability) => capability.id === 'operational_forecast') && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={isPending}
                onClick={() =>
                  void ask(
                    'Prepare the authorised operational forecast for the next 30 days. Include the data period, projected value if available, and limitations.',
                    'operational_forecast',
                  )
                }
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                {isPending ? 'Preparing forecast…' : 'Generate AI forecast from real records'}
              </Button>
            )}
            <fieldset>
              <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What to ask about
              </legend>
              {/*
                A radio group rather than a <select>: every option is visible, so
                the reader can see what the assistant covers before asking. Arrow
                keys move between them and the accessible name is the group label.
              */}
              <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label="Assistant capability">
                {available.map((capability) => {
                  const isSelected = capability.id === selected?.id;
                  return (
                    <label
                      key={capability.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ai-capability"
                        value={capability.id}
                        checked={isSelected}
                        onChange={() => setCapabilityId(capability.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{capability.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {capability.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <form onSubmit={handleSubmit} className="space-y-2">
              <label htmlFor="ai-question" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your question
              </label>
              <Textarea
                id="ai-question"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={compact ? 2 : 3}
                placeholder={selected?.suggestedQuestion ?? 'Ask a question about your work'}
                maxLength={4000}
                className="resize-y"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !message.trim() || !selected}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      Thinking…
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Ask
                    </>
                  )}
                </Button>
                {selected ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void ask(selected.suggestedQuestion, selected.id)}
                    disabled={isPending}
                  >
                    Use suggested question
                  </Button>
                ) : null}
              </div>
            </form>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}

            {/*
              Answers are rendered as text, never as HTML. Model output is
              untrusted input and this is the boundary that keeps it that way.
            */}
            <div aria-live="polite" className="space-y-3">
              {turns.map((turn, index) => (
                <div key={`${turn.conversationId}-${index}`} className="rounded-lg border border-border p-3">
                  <p className="whitespace-pre-wrap text-sm">{turn.answer}</p>

                  {turn.urgentConcernDetected ? (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        If this describes an emergency, contact your local emergency number now.
                        The assistant explains records; it does not triage, and it must never delay
                        urgent care.
                      </span>
                    </div>
                  ) : null}

                  {turn.requiresHumanReview ? (
                    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {turn.reviewNotice ??
                        'This is an AI-generated draft. A qualified clinician must review and approve it before use.'}
                    </p>
                  ) : null}

                  {turn.sources.length > 0 ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Source
                      </p>
                      <ul className="space-y-0.5">
                        {turn.sources.map((source) => (
                          <li key={source} className="text-xs text-muted-foreground">
                            {source}
                          </li>
                        ))}
                      </ul>
                      {turn.computedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Data as of {new Date(turn.computedAt).toLocaleString()}
                        </p>
                      ) : null}
                      {turn.containsIdentifiableData ? (
                        <Badge variant="warning" className="mt-1">
                          Includes patient-identifiable information
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Persistent dashboard forecast. It uses the same role-scoped endpoint as the
 * chat panel, but keeps verified operational facts visible without opening chat.
 */
export function AiForecastCard({ className }: { className?: string }) {
  const role = useAuthStore((state) => state.user?.role);
  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: getAiCapabilities,
    staleTime: 5 * 60_000,
  });
  const forecast = useQuery({
    queryKey: ['ai', 'forecast'],
    queryFn: getAiForecast,
    enabled:
      capabilities.isSuccess &&
      capabilities.data.capabilities.some(
        (capability) => capability.id === 'operational_forecast'
      ),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (capabilities.isLoading) {
    return <div className={className}><ForecastSummary loading /></div>;
  }
  if (!capabilities.data?.capabilities.some((item) => item.id === 'operational_forecast')) {
    return null;
  }

  return (
    <div className={className}>
      <ForecastSummary
        data={forecast.data}
        loading={forecast.isLoading}
        error={forecast.error ? aiErrorMessage(forecast.error) : null}
        role={role}
      />
    </div>
  );
}

function ForecastSummary({
  data,
  loading,
  error,
  role,
  onSuggestion,
}: {
  data?: { facts: Record<string, unknown>; sources: string[]; computedAt: string };
  loading: boolean;
  error?: string | null;
  role?: string;
  onSuggestion?: (question: string) => void;
}) {
  if (loading) return <p className="rounded-lg border p-3">Loading authorised forecast data…</p>;
  if (error) return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>;
  if (!data) return null;

  const facts = data.facts;
  const detailFacts = Object.entries(facts).filter(
    ([key]) => !['metric', 'reason', 'limitations', 'suggestions'].includes(key)
  );
  const suggestions = Array.isArray(facts.suggestions)
    ? facts.suggestions.filter((suggestion): suggestion is string => typeof suggestion === 'string')
    : [];
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-blue-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
        <CalendarClock className="h-4 w-4" aria-hidden />
          Real-data operational forecast
        </div>
        {role ? <RoleBadge role={role} /> : null}
      </div>
      <p className="mt-1 text-xs text-blue-900">{forecastMetricDescription(String(facts.metric ?? 'Operational metric'))}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {detailFacts.map(([key, value]) => (
          <div key={key} className="rounded-md border border-blue-200/80 bg-white/60 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
              {formatForecastLabel(key)}
            </p>
            <p className="mt-0.5 break-words text-sm font-medium">
              {formatForecastValue(value)}
            </p>
          </div>
        ))}
      </div>
      {facts.reason ? <p className="mt-2 text-xs text-blue-900">{String(facts.reason)}</p> : null}
      {facts.limitations ? <p className="mt-2 text-xs text-blue-900">{String(facts.limitations)}</p> : null}
      {suggestions.length > 0 ? (
        <div className="mt-3 border-t border-blue-200/80 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
            Suggested next steps
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) =>
              onSuggestion ? (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-blue-300 bg-white/80 px-3 py-1.5 text-left text-xs text-blue-900 transition-colors hover:bg-white"
                  onClick={() => onSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ) : (
                <span
                  key={suggestion}
                  className="rounded-full border border-blue-200 bg-white/60 px-3 py-1.5 text-xs text-blue-900"
                >
                  {suggestion}
                </span>
              )
            )}
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-blue-800">
        Computed {new Date(data.computedAt).toLocaleString()} from {data.sources.join(' · ')}.
        This is directional information, not a guarantee.
      </p>
    </section>
  );
}

function formatForecastValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${formatForecastLabel(key)}: ${formatForecastValue(nestedValue)}`)
      .join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  return String(value);
}

function formatForecastLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b30\s*day\b/gi, '30-day')
    .replace(/\b(\w+)30\s*day\b/gi, '$1 30-day')
    .replace(/\s+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function forecastMetricDescription(metric: string): string {
  const descriptions: Record<string, string> = {
    'hospital appointments': 'Hospital appointments across all authorised modules',
    "caller doctor's appointments": "Appointments in your doctor workload",
    "caller's appointments": 'Your appointments and recent booking activity',
    'assigned patients': 'Patients currently assigned to your care',
    'laboratory queue': 'Current laboratory order and result workload',
    'stock batches nearing expiry': 'Inventory batches requiring attention in the next 30 days',
    'financial activity': 'Billing activity and outstanding financial balances',
  };
  return descriptions[metric] ?? metric;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full border border-blue-200 bg-white/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-800">
      {role.replace(/_/g, ' ')}
    </span>
  );
}

/**
 * Confirmation card for a proposed appointment change.
 *
 * <p>Kept separate from the chat so it cannot be rendered inline with an answer
 * and read as though it had already happened. The description says what <em>will</em>
 * happen, and both buttons are always present — a proposal with no visible way to
 * refuse is a trap.
 */
export function AiActionProposal({
  id,
  description,
  onResolved,
}: {
  id: string;
  description: string;
  onResolved?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const resolve = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = accept
        ? await confirmAiAction(id)
        : (await rejectAiAction(id), { resultMessage: 'Discarded. Nothing was changed.' });
      setResolved(true);
      setMessage(result.resultMessage ?? (accept ? 'Applied.' : 'Discarded.'));
      onResolved?.(result.resultMessage ?? '');
    } catch (error) {
      // A slot taken in the meantime, or a permission changed: the server
      // re-checks at commit time, and the message says so rather than implying
      // the change went through.
      setMessage(aiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (resolved) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-start gap-2 pt-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 text-green-600" aria-hidden />
          <span>{message ?? 'Done.'}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4" aria-hidden />
          Proposed change — nothing has been saved
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? (
          <p role="alert" className="text-sm text-amber-900">
            {message}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void resolve(true)} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Confirm and apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => void resolve(false)} disabled={busy}>
            <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Discard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}