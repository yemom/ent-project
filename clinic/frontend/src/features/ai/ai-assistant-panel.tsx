'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useAuthStore } from '@/store/auth-store';
import {
  aiErrorMessage,
  askAiAssistant,
  confirmAiAction,
  getAiCapabilities,
  getAiForecast,
  listPendingAiActions,
  proposeAiAction,
  rejectAiAction,
  type AiPendingAction,
  type AiChatResponse,
  getAiConversation,
  listAiConversations,
  type AiMessage,
  getAiAppointmentForecast,
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
  const queryClient = useQueryClient();
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
  const pendingActions = useQuery({
    queryKey: ['ai', 'actions', 'pending'],
    queryFn: listPendingAiActions,
    enabled: capabilities.isSuccess && capabilities.data.available,
    staleTime: 30_000,
    retry: 1,
  });
  const conversations = useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: listAiConversations,
    enabled: capabilities.isSuccess && capabilities.data.available,
    staleTime: 30_000,
  });

  const [capabilityId, setCapabilityId] = useState<string | null>(null);
  /**
   * Answers typed into the selected capability's own inputs, keyed by argument name.
   *
   * <p>Kept as one flat record rather than per-capability state so switching between
   * capabilities does not lose what the user already typed.
   */
  const [capabilityArguments, setCapabilityArguments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<AiChatResponse[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadedMessages, setLoadedMessages] = useState<AiMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AiPendingAction | null>(null);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    patientId: String(contextArguments?.patientId ?? ''),
    doctorId: '',
    appointmentDate: '',
    durationMinutes: '30',
    reason: '',
  });
  const [proposalCreateError, setProposalCreateError] = useState<string | null>(null);
  const [resolvedProposal, setResolvedProposal] = useState<AiPendingAction | null>(null);

  const conversationId = activeConversationId ?? turns[turns.length - 1]?.conversationId ?? null;
  const selectedConversation = useQuery({
    queryKey: ['ai', 'conversation', activeConversationId],
    queryFn: () => getAiConversation(activeConversationId!),
    enabled: Boolean(activeConversationId),
  });
  useEffect(() => {
    if (selectedConversation.data) {
      setLoadedMessages(selectedConversation.data);
      setTurns([]);
    }
  }, [selectedConversation.data]);

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
        // Page-level context (an open patient, say) and the answers typed into the
        // capability's own inputs are merged, with the typed value winning: it is the
        // more specific of the two. Undefined and blank entries are dropped so an
        // untouched field never overwrites real context with an empty value.
        const merged: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(contextArguments ?? {})) {
          if (value !== undefined && String(value).trim() !== '') merged[key] = value;
        }
        for (const [key, value] of Object.entries(capabilityArguments)) {
          const trimmed = String(value ?? '').trim();
          if (trimmed) merged[key] = trimmed;
        }

        const response = await askAiAssistant({
          capabilityId: capability,
          message: question,
          conversationId,
          arguments: merged,
        });
        setActiveConversationId(response.conversationId);
        setLoadedMessages([]);
        setTurns((previous) => [...previous, response]);
        void queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
      } catch (err) {
        setError(aiErrorMessage(err));
      } finally {
        inFlight.current = false;
        setIsPending(false);
      }
    },
    [conversationId, contextArguments, capabilityArguments, queryClient]
  );

  const resolveProposal = useCallback(
    async (id: string, accept: boolean) => {
      setProposalBusy(true);
      setProposalMessage(null);
      try {
        if (accept) {
          const result = await confirmAiAction(id);
          setProposalMessage(result.resultMessage ?? 'Applied.');
          setResolvedProposal(result);
        } else {
          await rejectAiAction(id);
          setProposalMessage('Discarded.');
          setResolvedProposal(null);
        }
        setProposal(null);
        await queryClient.invalidateQueries({ queryKey: ['ai', 'actions', 'pending'] });
      } catch (err) {
        setProposalMessage(aiErrorMessage(err));
        await queryClient.invalidateQueries({ queryKey: ['ai', 'actions', 'pending'] });
      } finally {
        setProposalBusy(false);
      }
    },
    [queryClient]
  );

  const createBookingProposal = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (proposalBusy) return;
      setProposalBusy(true);
      setProposalCreateError(null);
      setProposalMessage(null);
      setResolvedProposal(null);
      try {
        const created = await proposeAiAction({
          type: 'BOOK',
          conversationId,
          patientId: proposalForm.patientId.trim(),
          doctorId: proposalForm.doctorId.trim(),
          appointmentDate: proposalForm.appointmentDate,
          durationMinutes: Number(proposalForm.durationMinutes),
          reason: proposalForm.reason.trim() || undefined,
        });
        setProposal(created);
        setProposalMessage('Proposal prepared. Review it before confirming.');
        await queryClient.invalidateQueries({ queryKey: ['ai', 'actions', 'pending'] });
      } catch (err) {
        setProposalCreateError(aiErrorMessage(err));
      } finally {
        setProposalBusy(false);
      }
    },
    [conversationId, proposalBusy, proposalForm, queryClient]
  );

  const updateProposalField = (field: keyof typeof proposalForm, value: string) => {
    setProposalForm((current) => ({ ...current, [field]: value }));
  };

  const available = useMemo(() => capabilities.data?.capabilities ?? [], [capabilities.data?.capabilities]);
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
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p role="alert">{aiErrorMessage(capabilities.error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void capabilities.refetch()}>Retry</Button>
        </CardContent>
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
          {compact ? <ForecastSummary data={forecast.data} loading={forecast.isLoading} /> : null}
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Available
  // ------------------------------------------------------------------

  return (
    <Card className={`overflow-hidden shadow-sm ${className ?? ''}`}>
      <CardHeader className="border-b border-border bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle id={compact ? undefined : 'ai-chat-heading'} className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" aria-hidden />
            {compact ? 'Assistant' : 'Ask about the business'}
          </CardTitle>
          {!compact ? <Badge variant="outline">Review before changes</Badge> : null}
        </div>
        <CardDescription className="text-xs leading-5">
          Answers use records you can access and show their sources. This assistant cannot apply changes without your confirmation.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {compact ? <ForecastSummary
          data={forecast.data}
          loading={forecast.isLoading}
          onSuggestion={(question) => void ask(question, 'operational_forecast')}
        /> : null}
        {!compact ? (
          <details className="order-1 rounded-lg border border-border px-3 py-2" aria-label="Conversation history">
            <summary className="cursor-pointer text-xs font-medium">Saved conversations</summary>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Continue a previous conversation or start a new one.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setActiveConversationId(null); setLoadedMessages([]); setTurns([]); }}>New conversation</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void conversations.refetch()} disabled={conversations.isFetching}>Refresh</Button>
              </div>
            </div>
            {conversations.isLoading ? <p role="status" className="mt-2 text-xs text-muted-foreground">Loading saved conversations…</p> : null}
            {conversations.error ? <p role="alert" className="mt-2 text-xs text-destructive">Could not load conversation history. Use Refresh to retry.</p> : null}
            {conversations.data?.length ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {conversations.data.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => { setActiveConversationId(conversation.id); setTurns([]); }}
                    aria-current={conversation.id === activeConversationId ? 'page' : undefined}
                    className={`min-w-40 rounded-lg border px-3 py-2 text-left text-xs ${conversation.id === activeConversationId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <span className="block truncate font-medium">{conversation.title ?? 'Assistant conversation'}</span>
                    <span className="mt-1 block text-muted-foreground">{new Date(conversation.updatedAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ) : !conversations.isLoading && !conversations.error ? <p className="mt-2 text-xs text-muted-foreground">No saved conversations yet.</p> : null}
          </details>
        ) : null}
        {selectedConversation.isLoading ? <p role="status" className="order-2 text-sm text-muted-foreground">Loading conversation…</p> : null}
        {selectedConversation.error ? <div role="alert" className="order-2 rounded-lg border border-destructive/40 p-3 text-sm">Could not load this conversation. <Button size="sm" variant="outline" onClick={() => void selectedConversation.refetch()}>Retry</Button></div> : null}
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
                className={compact ? 'w-full justify-start gap-2' : 'order-3 h-8 w-fit justify-start gap-2 text-xs'}
                disabled={isPending}
                onClick={() =>
                  void ask(
                    'Summarise the authorised operational metrics, comparison period, any calculated projection, and limitations.',
                    'operational_forecast',
                  )
                }
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                {isPending ? 'Preparing summary…' : 'Explain operational data'}
              </Button>
            )}
            <fieldset className={compact ? '' : 'order-4'}>
              <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What to ask about
              </legend>
              {/*
                A radio group rather than a <select>: every option is visible, so
                the reader can see what the assistant covers before asking. Arrow
                keys move between them and the accessible name is the group label.
              */}
              <div className={`mt-2 flex gap-2 ${compact ? 'flex-col' : 'overflow-x-auto pb-1'}`} role="radiogroup" aria-label="Assistant capability">
                {available.map((capability) => {
                  const isSelected = capability.id === selected?.id;
                  return (
                    <label
                      key={capability.id}
                      className={`flex cursor-pointer items-start gap-2 border transition-colors ${compact ? 'rounded-lg px-3 py-2 text-sm' : 'shrink-0 rounded-full px-3 py-1.5 text-xs'} ${
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
                        className={compact ? 'mt-1' : 'sr-only'}
                      />
                      <span className="whitespace-nowrap">
                        <span className="font-medium">{capability.label}</span>
                        <span className={`block text-xs text-muted-foreground ${compact ? '' : 'hidden'}`}>
                          {capability.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {!compact ? (
              <div className="order-5 flex flex-wrap gap-1.5" aria-label="Suggested questions">
                {available.slice(0, 4).map((capability) => (
                  <button key={capability.id} type="button" disabled={isPending} title={capability.suggestedQuestion}
                    onClick={() => void ask(capability.suggestedQuestion, capability.id)}
                    className="max-w-full truncate rounded-full border border-border bg-background px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                    {capability.suggestedQuestion.length > 46
                      ? `${capability.suggestedQuestion.slice(0, 46)}…`
                      : capability.suggestedQuestion}
                  </button>
                ))}
              </div>
            ) : null}

            {/*
              Argument inputs, rendered from the server's declaration rather than a
              hard-coded list. A capability that cannot answer without one — "which
              doctor?", "which patient?" — used to fail on every attempt with an error
              that named authorisation rather than the missing field.
            */}
            {selected?.requiredArguments?.map((argument) => (
              <div key={argument.name} className={`space-y-1.5 ${compact ? '' : 'order-6'}`}>
                <label
                  htmlFor={`ai-arg-${argument.name}`}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {argument.prompt}
                </label>
                <input
                  id={`ai-arg-${argument.name}`}
                  value={capabilityArguments[argument.name] ?? ''}
                  onChange={(event) =>
                    setCapabilityArguments((current) => ({
                      ...current,
                      [argument.name]: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}

            <form onSubmit={handleSubmit} className={`space-y-2 ${compact ? '' : 'order-8'}`}>
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
                className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${compact ? '' : 'order-9'}`}
              >
                {error}
              </div>
            ) : null}

            {available.some((capability) => capability.id === 'available_slots') ? (
              <section className={`rounded-xl border border-border bg-muted/20 p-4 ${compact ? '' : 'order-10'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Appointment proposal</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prepare a typed suggestion from authorised data. No appointment is created until you confirm it.
                    </p>
                  </div>
                  <Badge variant="outline">Human confirmation required</Badge>
                </div>
                <form onSubmit={createBookingProposal} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="ai-proposal-patient" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Patient ID
                    </label>
                    <input
                      id="ai-proposal-patient"
                      required
                      value={proposalForm.patientId}
                      onChange={(event) => updateProposalField('patientId', event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ai-proposal-doctor" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Clinician ID
                    </label>
                    <input
                      id="ai-proposal-doctor"
                      required
                      value={proposalForm.doctorId}
                      onChange={(event) => updateProposalField('doctorId', event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ai-proposal-date" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Proposed date and time
                    </label>
                    <input
                      id="ai-proposal-date"
                      type="datetime-local"
                      required
                      value={proposalForm.appointmentDate}
                      onChange={(event) => updateProposalField('appointmentDate', event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ai-proposal-duration" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Duration (minutes)
                    </label>
                    <input
                      id="ai-proposal-duration"
                      type="number"
                      min={5}
                      max={480}
                      required
                      value={proposalForm.durationMinutes}
                      onChange={(event) => updateProposalField('durationMinutes', event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="ai-proposal-reason" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Reason (optional)
                    </label>
                    <input
                      id="ai-proposal-reason"
                      maxLength={500}
                      value={proposalForm.reason}
                      onChange={(event) => updateProposalField('reason', event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm" disabled={proposalBusy}>
                      {proposalBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {proposalBusy ? 'Preparing…' : 'Prepare proposal'}
                    </Button>
                  </div>
                </form>
                {proposalCreateError ? (
                  <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {proposalCreateError}
                  </p>
                ) : null}
              </section>
            ) : null}

            <div className={compact ? '' : 'order-11'}>
              <PendingProposals
                actions={pendingActions.data ?? []}
                loading={pendingActions.isLoading}
                error={pendingActions.error ? aiErrorMessage(pendingActions.error) : null}
                activeProposal={proposal}
                resolvedProposal={resolvedProposal}
                message={proposalMessage}
                busy={proposalBusy}
                onRefresh={() => void pendingActions.refetch()}
                onResolve={(id, accept) => void resolveProposal(id, accept)}
              />
            </div>

            {/*
              Answers are rendered as text, never as HTML. Model output is
              untrusted input and this is the boundary that keeps it that way.
            */}
            <div aria-live="polite" className={`space-y-3 ${compact ? '' : 'order-7'}`}>
              {loadedMessages.map((turn) => (
                <div key={turn.id} className={`rounded-lg border p-3 ${turn.role === 'user' ? 'ml-6 bg-muted/50' : 'mr-6 bg-card'}`}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{turn.role === 'user' ? 'You' : 'Assistant'} · {new Date(turn.createdAt).toLocaleString()}</p>
                  <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
                  {turn.requiresHumanReview ? <p className="mt-2 rounded border border-amber-300 p-2 text-xs text-amber-900">Draft requires qualified clinician review.</p> : null}
                </div>
              ))}
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

import { AiExecutiveDashboard } from '@/features/ai/ai-executive-dashboard';

/**
 * Persistent dashboard forecast and assistant suite matching StockFlow's layout.
 * Combines date range filtering, forecast chart, clinical assistant, and 'What the numbers say'.
 */
export function AiForecastCard({ className }: { className?: string }) {
  return <AiExecutiveDashboard className={className} />;
}

function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateRangeEndingToday(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { from: localDateValue(start), to: localDateValue(end) };
}

export function AiAppointmentHistoryCard() {
  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: getAiCapabilities,
    staleTime: 5 * 60_000,
  });
  const enabled = capabilities.data?.capabilities.some((item) => item.id === 'operational_forecast') === true;
  const today = localDateValue(new Date());
  const defaultRange = useMemo(() => dateRangeEndingToday(90), []);
  const defaultFrom = defaultRange.from;
  const [activeRange, setActiveRange] = useState('90');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultRange.to);
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultRange.to);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['ai', 'appointment-history', from, to],
    queryFn: () => getAiAppointmentForecast(from, to),
    enabled: enabled && Boolean(from && to && from <= to && to <= today),
    staleTime: 60_000,
  });
  const applyRange = (start = draftFrom, end = draftTo, preset: string | null = null) => {
    if (!start || !end || start > end || end > today) {
      setRangeError('Choose a valid range ending today or earlier.');
      return;
    }
    if (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime() > 365 * 86400000) {
      setRangeError('The history range cannot exceed 366 days.');
      return;
    }
    setRangeError(null);
    setActiveRange(preset ?? '');
    setDraftFrom(start);
    setDraftTo(end);
    if (start === from && end === to) void query.refetch();
    else {
      setFrom(start);
      setTo(end);
    }
  };
  const data = query.data;
  const chartData = data ? [
    ...data.actual.map((point) => ({ ...point, actual: point.value, predicted: null as number | null })),
    ...data.predicted.map((point) => ({ ...point, actual: null as number | null, predicted: point.value })),
  ] : [];
  const actualTotal = data?.actual.reduce((sum, point) => sum + point.value, 0) ?? 0;
  const nextWeekTotal = data?.predicted.reduce((sum, point) => sum + point.value, 0) ?? 0;

  if (capabilities.isLoading) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading appointment forecast…</CardContent></Card>;
  }
  if (!enabled) return null;

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle id="ai-appointment-trend" className="text-base">Appointment forecast</CardTitle>
            <CardDescription className="mt-1">Recorded activity with a transparent seven-day baseline.</CardDescription>
          </div>
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">7-day baseline</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5" aria-label="Quick date range">
            {[
              { id: '30', label: 'Last 30 days', days: 30 },
              { id: '90', label: 'Last 90 days', days: 90 },
              { id: '365', label: 'Last 12 months', days: 365 },
            ].map((range) => (
              <Button key={range.id} type="button" size="sm" variant={activeRange === range.id ? 'default' : 'ghost'} className="h-8 px-2.5 text-xs" onClick={() => {
                const selected = dateRangeEndingToday(range.days);
                applyRange(selected.from, selected.to, range.id);
              }}>{range.label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[11px] text-muted-foreground">From<input aria-label="History start date" type="date" value={draftFrom} max={draftTo || today} onChange={(event) => { setActiveRange(''); setDraftFrom(event.target.value); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" /></label>
            <span className="pb-2 text-xs text-muted-foreground">to</span>
            <label className="grid gap-1 text-[11px] text-muted-foreground">To<input aria-label="History end date" type="date" value={draftTo} max={today} onChange={(event) => { setActiveRange(''); setDraftTo(event.target.value); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" /></label>
            <Button type="button" size="sm" variant="outline" onClick={() => applyRange()} disabled={query.isFetching} className="h-8">{query.isFetching ? 'Loading…' : 'Apply'}</Button>
          </div>
        </div>
        {rangeError ? <p role="alert" className="text-sm text-destructive">{rangeError}</p> : null}
        {query.isLoading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading dated appointment records…</p> : null}
        {query.error ? <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">Unable to load appointment history. <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div> : null}
        {data ? <>
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricTile label="Recorded appointments" value={actualTotal.toLocaleString()} detail={`${data.actual.length} days in range`} />
            <MetricTile label="Daily average" value={data.actual.length ? (actualTotal / data.actual.length).toFixed(1) : '0'} detail="Measured appointments per day" />
            <MetricTile label="Next 7 days" value={data.sufficientHistory ? nextWeekTotal.toLocaleString() : '—'} detail={data.sufficientHistory ? 'Baseline estimate' : 'History threshold not met'} accent />
            <MetricTile label="Data scope" value={data.scope.toLowerCase()} detail={`${data.observationCount} daily observations`} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{data.metric} · {data.from} through {data.to}</span><span>Updated {new Date(data.computedAt).toLocaleString()}</span></div>
          {data.sufficientHistory ? (
            <div role="img" aria-label={`Daily appointment history from ${data.from} to ${data.to}, with a seven-day baseline estimate`} className="h-64 w-full rounded-xl border border-border bg-background px-2 py-3">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} minTickGap={25} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(value) => String(value)} contentStyle={{ borderRadius: 10, borderColor: 'hsl(var(--border))' }} />
                <Legend verticalAlign="top" align="right" height={28} />
                <Line type="monotone" dataKey="actual" name="Recorded appointments" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="predicted" name="7-day baseline" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls activeDot={{ r: 4 }} />
              </LineChart></ResponsiveContainer>
            </div>
          ) : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Insufficient history for an estimate. {data.limitation}</p>}
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium">How this forecast was produced</summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{data.method}. {data.limitation} Sources: {data.sources.join(' · ')}.</p>
          </details>
          {data.insights.map((insight) => <article key={insight.title} className="rounded-xl border border-border bg-muted/20 p-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{insight.title}</p><Badge variant="outline">Measured</Badge></div><p className="mt-1 text-sm text-muted-foreground">{insight.explanation}</p><p className="mt-2 text-xs text-muted-foreground">{insight.period} · {insight.source}</p></article>)}
        </> : null}
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${accent ? 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30' : 'border-border bg-muted/20'}`}>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function PendingProposals({
  actions,
  loading,
  error,
  activeProposal,
  resolvedProposal,
  message,
  busy,
  onRefresh,
  onResolve,
}: {
  actions: AiPendingAction[];
  loading: boolean;
  error: string | null;
  activeProposal: AiPendingAction | null;
  resolvedProposal: AiPendingAction | null;
  message: string | null;
  busy: boolean;
  onRefresh: () => void;
  onResolve: (id: string, accept: boolean) => void;
}) {
  const visible = activeProposal && !actions.some((action) => action.id === activeProposal.id)
    ? [activeProposal, ...actions]
    : actions;

  return (
    <section className="rounded-xl border border-border p-4" aria-labelledby="ai-pending-proposals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="ai-pending-proposals" className="text-sm font-semibold">Appointment proposals</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Review the patient, clinician, time, and reason before applying any change.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </div>
      {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading pending proposals…</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No proposals are waiting for your decision.</p>
      ) : null}
      <div className="mt-3 space-y-3">
        {visible.map((action) => {
          const awaiting = action.status === 'PROPOSED';
          return (
            <article key={action.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{action.type?.replaceAll('_', ' ') ?? 'Appointment change'}</p>
                  <p className="mt-1 text-sm text-foreground">{action.description ?? 'Details unavailable.'}</p>
                </div>
                <Badge variant={awaiting ? 'warning' : 'outline'}>{action.status}</Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div><dt className="font-medium text-foreground">Created</dt><dd>{formatProposalDate(action.createdAt)}</dd></div>
                <div><dt className="font-medium text-foreground">Expires</dt><dd>{formatProposalDate(action.expiresAt)}</dd></div>
                {action.appointmentId ? <div><dt className="font-medium text-foreground">Appointment</dt><dd>{action.appointmentId}</dd></div> : null}
              </dl>
              {action.resultMessage ? <p className="mt-3 text-sm text-muted-foreground">{action.resultMessage}</p> : null}
              {awaiting ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={() => onResolve(action.id, true)}>
                    <Check className="h-4 w-4" aria-hidden />
                    Confirm
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onResolve(action.id, false)}>
                    <X className="h-4 w-4" aria-hidden />
                    Reject
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {resolvedProposal ? (
        <p role="status" className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Persisted state: {resolvedProposal.status.toLowerCase()}.
        </p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}

function formatProposalDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ForecastSummary({
  data,
  loading,
  error,
  role,
  onSuggestion,
  onRetry,
}: {
  data?: { facts: Record<string, unknown>; sources: string[]; computedAt: string };
  loading: boolean;
  error?: string | null;
  role?: string;
  onSuggestion?: (question: string) => void;
  onRetry?: () => void;
}) {
  if (loading) return <p className="rounded-lg border p-3" role="status">Loading authorised operational data…</p>;
  if (error) return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span>{error}</span>
      {onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
  if (!data) return null;

  const facts = data.facts;
  const detailFacts = Object.entries(facts).filter(
    ([key]) => !['metric', 'reason', 'limitations', 'suggestions'].includes(key)
  );
  const suggestions = Array.isArray(facts.suggestions)
    ? facts.suggestions.filter((suggestion): suggestion is string => typeof suggestion === 'string')
    : [];
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
            Operational snapshot
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{forecastMetricDescription(String(facts.metric ?? 'Operational metric'))}</p>
        </div>
        {role ? <RoleBadge role={role} /> : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {detailFacts.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {formatForecastLabel(key)}
            </p>
            <p className="mt-1 break-words text-lg font-semibold tracking-tight text-foreground">
              {formatForecastValue(value)}
            </p>
          </div>
        ))}
      </div>
      {facts.reason || facts.limitations ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{[facts.reason, facts.limitations].filter(Boolean).map(String).join(' ')}</p> : null}
      {suggestions.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Suggested next steps</p>
            {suggestions.map((suggestion) =>
              onSuggestion ? (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                  onClick={() => onSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ) : (
                <span
                  key={suggestion}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  {suggestion}
                </span>
              )
            )}
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Computed {new Date(data.computedAt).toLocaleString()} from {data.sources.join(' · ')}.
        {facts.forecastAvailable === true
          ? ' The displayed projection is a simple comparison-based estimate, not a validated predictive model.'
          : ' This is a current operational snapshot; dated historical observations are unavailable for a defensible time-series forecast.'}
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
