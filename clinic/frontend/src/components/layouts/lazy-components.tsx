'use client';

import dynamic from 'next/dynamic';

/**
 * Recharts pulls in a large charting bundle that only the admin dashboard and
 * analytics page need. Loading it lazily keeps it out of the shared shell chunk
 * that every authenticated page loads.
 */
export const OverviewChart = dynamic(
  () => import('@/components/charts/overview-chart').then((mod) => mod.OverviewChart),
  {
    ssr: false,
    loading: () => <div className="h-80 w-full animate-pulse rounded-2xl bg-muted" aria-hidden />,
  }
);

export default OverviewChart;