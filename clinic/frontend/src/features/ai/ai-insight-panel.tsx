'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Calendar,
  CheckCircle2,
  FileText,
  Info,
  PillBottle,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AiHistoricalForecastResponse } from '@/services/api/ai';

export interface InsightItem {
  category: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
  badgeColorClass?: string;
  title: string;
  explanation: string;
  period?: string;
  source?: string;
}

export interface AiInsightPanelProps {
  forecast?: AiHistoricalForecastResponse;
  isLoading?: boolean;
}

export function AiInsightPanel({ forecast, isLoading }: AiInsightPanelProps) {
  if (isLoading) {
    return (
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              What the numbers say
            </h3>
            <span className="text-xs text-muted-foreground">Analysing…</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const backendInsights = forecast?.insights ?? [];
  const actual = forecast?.actual ?? [];
  const actualTotal = actual.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const from = forecast?.from ?? '';
  const to = forecast?.to ?? '';

  // Generate dynamic clinical observations matching StockFlow's structure
  const observations: InsightItem[] = [];

  if (backendInsights.length > 0) {
    backendInsights.forEach((bi) => {
      observations.push({
        category: 'APPOINTMENTS',
        badgeColorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
        title: bi.title,
        explanation: bi.explanation,
        period: bi.period,
        source: bi.source,
      });
    });
  } else {
    // 1. Throughput observation
    observations.push({
      category: 'APPOINTMENTS',
      badgeColorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
      title: 'Appointment throughput',
      explanation: `Total visits recorded across the selected window: ${actualTotal} appointments over ${actual.length} calendar days. Daily volume average is ${(actual.length > 0 ? actualTotal / actual.length : 0).toFixed(1)} consultations/day.`,
      period: `${from} to ${to}`,
      source: 'Appointments module; daily persisted consultation records',
    });

    // 2. Schedule capacity & distribution
    observations.push({
      category: 'CAPACITY',
      badgeColorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      title: 'Clinical scheduling distribution',
      explanation: 'Scheduled consultation slots are distributed across active doctor rosters. Automated exclusion constraint V28 ensures zero doctor double-booking across hospital time slots.',
      period: 'Active roster horizon',
      source: 'Scheduling & Doctor Availability service',
    });

    // 3. Ward & Inpatient Flow
    observations.push({
      category: 'INPATIENT',
      badgeColorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
      title: 'Bed allocation & Ward operations',
      explanation: 'Department admissions and room assignments are tracked with real-time nursing observation logs (vitals and medication administration records).',
      period: 'Current operational window',
      source: 'Hospital Operations, Rooms and Wards registry',
    });

    // 4. Pharmacy & Batches
    observations.push({
      category: 'PHARMACY',
      badgeColorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
      title: 'Prescription inventory sufficiency',
      explanation: 'Medicine stock levels and batch expiry timestamps are verified before dispensing. Near-expiry items trigger early administrative restock notifications.',
      period: 'Next 30-day inventory horizon',
      source: 'Pharmacy inventory & Stock Batches ledger',
    });

    // 5. Audit & Data Integrity
    observations.push({
      category: 'GOVERNANCE',
      badgeColorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      title: 'Role-based access & Clinical auditing',
      explanation: 'All clinical changes and AI assistant interactions are immutably logged with actor IDs and timestamp verification.',
      period: 'Continuous logging',
      source: 'System Audit Log and RBAC enforcement engine',
    });
  }

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            What the numbers say
          </h3>
          <span className="text-xs text-muted-foreground font-medium">
            {observations.length} observation{observations.length === 1 ? '' : 's'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="divide-y divide-border p-0">
        {observations.map((item, index) => (
          <div key={index} className="p-4 transition hover:bg-muted/20">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${item.badgeColorClass ?? 'bg-muted text-foreground'}`}>
                {item.category}
              </span>
              <h4 className="text-sm font-semibold text-foreground">
                {item.title}
              </h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.explanation}
            </p>
            {item.period || item.source ? (
              <p className="mt-2 text-xs text-muted-foreground/75">
                {[item.period, item.source].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
