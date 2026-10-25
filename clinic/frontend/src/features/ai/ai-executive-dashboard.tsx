'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Database, Loader2, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ForecastChart } from '@/features/ai/forecast-chart';
import { AskAssistantPanel } from '@/features/ai/ask-assistant-panel';
import { AiInsightPanel } from '@/features/ai/ai-insight-panel';
import { getAiAppointmentForecast, type AiHistoricalForecastResponse } from '@/services/api/ai';

export interface DateRange {
  from: string;
  to: string;
}

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const lastNDays = (days: number): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(to) };
};

const thisMonthRange = (): DateRange => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: isoDay(start), to: isoDay(today) };
};

const lastMonthRange = (): DateRange => {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { from: isoDay(start), to: isoDay(end) };
};

const lastYearRange = (): DateRange => {
  const today = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  return { from: isoDay(from), to: isoDay(today) };
};

const RANGE_PRESETS = [
  { label: 'Last 30 days', getRange: () => lastNDays(30) },
  { label: 'Last 90 days', getRange: () => lastNDays(90) },
  { label: 'This month', getRange: thisMonthRange },
  { label: 'Last month', getRange: lastMonthRange },
  { label: 'Last year', getRange: lastYearRange },
];

export function AiExecutiveDashboard({ className }: { className?: string }) {
  const [range, setRange] = useState<DateRange>(() => lastNDays(30));
  const [activePreset, setActivePreset] = useState<string>('Last 30 days');
  const [horizon, setHorizon] = useState<number>(14);
  const [showFigureSource, setShowFigureSource] = useState<boolean>(false);

  const query = useQuery<AiHistoricalForecastResponse>({
    queryKey: ['ai', 'historical-forecast', range.from, range.to],
    queryFn: () => getAiAppointmentForecast(range.from, range.to),
    staleTime: 60_000,
  });

  const handlePresetSelect = (preset: typeof RANGE_PRESETS[0]) => {
    setActivePreset(preset.label);
    setRange(preset.getRange());
  };

  const actualList = query.data?.actual ?? [];
  const totalVisits = actualList.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* ── Top Date Filter Bar matching StockFlow ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">Date range</span>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Filter start date"
              value={range.from}
              max={range.to}
              onChange={(e) => {
                setActivePreset('');
                setRange({ ...range, from: e.target.value });
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="Filter end date"
              value={range.to}
              min={range.from}
              onChange={(e) => {
                setActivePreset('');
                setRange({ ...range, to: e.target.value });
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="ml-1 flex flex-wrap items-center gap-1">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  activePreset === preset.label
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {query.isFetching ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> Updating
          </span>
        ) : null}
      </div>

      {/* ── Where these figures come from bar matching StockFlow ─────────── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-foreground">Where these figures come from</h4>
            <p className="mt-0.5 text-muted-foreground">
              {range.from} – {range.to} · {actualList.length} observation days · {totalVisits} recorded consultations
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFigureSource(!showFigureSource)}
            className="flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {showFigureSource ? 'Hide' : 'Show'}
            {showFigureSource ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showFigureSource ? (
          <div className="mt-3 border-t border-border pt-3 space-y-1.5 text-muted-foreground">
            <p>
              Every figure shown here is read directly from PostgreSQL production tables (<code className="rounded bg-muted px-1 py-0.5 text-[11px]">appointments</code>, <code className="rounded bg-muted px-1 py-0.5 text-[11px]">users</code>, <code className="rounded bg-muted px-1 py-0.5 text-[11px]">invoices</code>, and <code className="rounded bg-muted px-1 py-0.5 text-[11px]">stock_batches</code>).
            </p>
            <p>
              Calculations are deterministic: there are no synthetic placeholder estimates. The trailing mean baseline provides predictive trajectory without hallucinating artificial figures.
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Main Side-by-Side Grid matching StockFlow ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ForecastChart
            forecast={query.data}
            isLoading={query.isLoading}
            horizon={horizon}
            onHorizonChange={setHorizon}
            error={query.error ? (query.error as Error).message : null}
          />
        </div>
        <div className="xl:col-span-1">
          <AskAssistantPanel range={range} />
        </div>
      </div>

      {/* ── What the numbers say (Insights Panel) matching StockFlow ─────── */}
      <AiInsightPanel forecast={query.data} isLoading={query.isLoading} />
    </div>
  );
}

export default AiExecutiveDashboard;
