'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalStats } from '@/features/admin/use-hospital-stats';

/**
 * Appointment volume from the database.
 *
 * <p>Previously this chart rendered a hardcoded seven-day array. It now plots the
 * `appointmentsTrend` series returned by `GET /api/v1/stats/hospital`, and shows
 * an explicit empty state when there is no data rather than inventing a shape.
 */
export function OverviewChart({ title = 'Operational Overview' }: { title?: string }) {
  const { data, isLoading, error } = useHospitalStats();

  const series = (data?.appointmentsTrend ?? []).map((point) => ({
    label: new Date(point.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    appointments: point.total,
  }));

  const hasData = series.some((point) => point.appointments > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Daily appointment volume, last 14 days</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-80 w-full">
            <Skeleton className="h-full w-full rounded-2xl" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Could not load appointment trends.
          </p>
        ) : !hasData ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            No appointments recorded in the last 14 days.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#volumeFill)"
                  name="Appointments"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}