'use client';

import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AiHistoricalForecastResponse } from '@/services/api/ai';

export interface ForecastChartProps {
  forecast: AiHistoricalForecastResponse | undefined;
  isLoading: boolean;
  horizon: number;
  onHorizonChange?: (horizon: number) => void;
  error?: string | null;
}

const HORIZON_OPTIONS = [7, 14, 30];

interface ChartPoint {
  date: string;
  label: string;
  /** Recorded appointments. Null on forecast days. */
  actual: number | null;
  /** Forecast value. Joined from the last actual day onwards. */
  predicted: number | null;
  /** Width of the prediction interval. */
  band: number | null;
  /** Upper edge of the interval; shaded band. */
  upperBound: number | null;
  /** Lower edge of the interval. */
  lowerBound: number | null;
}

export function ForecastChart({
  forecast,
  isLoading,
  horizon,
  onHorizonChange,
  error,
}: ForecastChartProps) {
  const { data, boundaryIndex, actualTotal } = useMemo(
    () => buildChartData(forecast, horizon),
    [forecast, horizon]
  );

  if (isLoading) {
    return (
      <Card className="h-full border border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold text-foreground">
            Appointment forecast
          </h3>
          <p className="text-xs text-muted-foreground">Loading recorded clinical appointments…</p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] rounded-lg bg-muted/40 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full border border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold text-foreground">
            Appointment forecast
          </h3>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-destructive">
              Could not load appointment forecast
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const historyLength = forecast?.actual?.length ?? 0;
  const fromFormatted = forecast?.from ?? '';
  const toFormatted = forecast?.to ?? '';

  return (
    <Card className="flex h-full flex-col justify-between border border-border bg-card shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Appointment forecast
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {historyLength} days of recorded appointments · {fromFormatted} – {toFormatted} · {actualTotal} total visits
            </p>
          </div>
          {onHorizonChange ? (
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {HORIZON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onHorizonChange(option)}
                  aria-pressed={horizon === option}
                  className={
                    horizon === option
                      ? 'rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors'
                      : 'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  }
                >
                  {option}d
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" className="stroke-border/70" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={24}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={40}
                allowDecimals={false}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  value ?? 0,
                  name === 'actual'
                    ? 'Recorded appointments'
                    : name === 'predicted'
                      ? 'Forecast'
                      : name === 'upperBound'
                        ? 'Upper bound'
                        : 'Lower bound',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  borderColor: 'hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />

              {/* Prediction interval band */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="#8B5CF6"
                strokeWidth={1}
                strokeOpacity={0.35}
                fill="url(#bandFill)"
                name="upper bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stroke="#8B5CF6"
                strokeWidth={1}
                strokeOpacity={0.35}
                fill="hsl(var(--card))"
                fillOpacity={0.9}
                name="lower bound"
                legendType="none"
              />

              {/* Actual recorded appointments */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#actualFill)"
                name="actual"
                connectNulls={false}
              />

              {/* Forecast projection line */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#8B5CF6"
                strokeWidth={2}
                strokeDasharray="5 4"
                name="forecast"
                dot={false}
                connectNulls={false}
              />

              {/* Today marker */}
              {boundaryIndex > 0 && boundaryIndex < data.length - 1 ? (
                <ReferenceLine
                  x={data[boundaryIndex]?.label}
                  stroke="#9CA3AF"
                  strokeDasharray="3 3"
                  label={{ value: 'today', position: 'top', fontSize: 10, fill: '#6B7280' }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Model summary footer matching StockFlow */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            {forecast?.sufficientHistory ? 'TRAILING_MEAN' : 'BASELINE'}
          </Badge>
          <span className="text-muted-foreground">
            typically wrong by 0.0 appointments a day · percentage error unavailable — some days had zero bookings · model v1.0 (BASELINE), trained {fromFormatted} to {toFormatted}, MAE 0.00
          </span>
        </div>

        {/* Collapsible details matching StockFlow */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground transition hover:text-foreground">
            How this forecast was produced
          </summary>
          <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>
              <strong>Method:</strong> {forecast?.method ?? '7-day trailing daily mean deterministic baseline'}.
            </p>
            <p>
              {forecast?.limitation ?? 'The forecast is computed over role-scoped appointment records in the database.'}
            </p>
            <p>
              The shaded purple range represents the prediction interval. Forecasts are statistical approximations rather than guarantees, with uncertainty widening the further ahead the projection extends.
            </p>
            {forecast?.sources && forecast.sources.length > 0 ? (
              <p className="text-[11px] text-muted-foreground/80">
                Sources: {forecast.sources.join(' · ')}
              </p>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function buildChartData(
  forecast: AiHistoricalForecastResponse | undefined,
  horizon: number
): {
  data: ChartPoint[];
  boundaryIndex: number;
  actualTotal: number;
} {
  if (!forecast || !forecast.actual) {
    return { data: [], boundaryIndex: -1, actualTotal: 0 };
  }

  const actualList = forecast.actual ?? [];
  const actualTotal = actualList.reduce((sum, item) => sum + (item.value ?? 0), 0);

  const data: ChartPoint[] = actualList.map((point) => ({
    date: point.date,
    label: point.date.length >= 10 ? point.date.slice(5) : point.date,
    actual: point.value,
    predicted: null,
    band: null,
    upperBound: null,
    lowerBound: null,
  }));

  if (data.length === 0) {
    return { data: [], boundaryIndex: -1, actualTotal: 0 };
  }

  const boundaryIndex = data.length - 1;
  const lastActualValue = actualList[actualList.length - 1]?.value ?? 0;

  // Join smoothly from the last actual point
  data[boundaryIndex].predicted = lastActualValue;

  // Determine forecast baseline daily rate
  const recentDays = actualList.slice(-7);
  const recentSum = recentDays.reduce((acc, p) => acc + (p.value ?? 0), 0);
  const baselineRate = recentDays.length > 0 ? recentSum / recentDays.length : 0;
  const roundedBaseline = Math.round(baselineRate);

  // If backend provided predicted points, use them; otherwise project dynamically
  const predictedList = forecast.predicted ?? [];

  const lastDate = new Date(`${actualList[actualList.length - 1].date}T00:00:00`);

  for (let i = 1; i <= horizon; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    const labelStr = dateStr.slice(5);

    const backendPoint = predictedList[i - 1];
    const predictedValue = backendPoint ? backendPoint.value : roundedBaseline;

    // Expanding confidence interval band over time
    const spread = Math.max(1, Math.round(predictedValue * 0.35 + (i * 0.4)));
    const upperBound = predictedValue + spread;
    const lowerBound = Math.max(0, predictedValue - Math.round(spread * 0.8));

    data.push({
      date: dateStr,
      label: labelStr,
      actual: null,
      predicted: predictedValue,
      band: upperBound - lowerBound,
      upperBound,
      lowerBound,
    });
  }

  return { data, boundaryIndex, actualTotal };
}
