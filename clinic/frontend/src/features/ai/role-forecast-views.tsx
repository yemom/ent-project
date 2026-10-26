'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Beaker,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HeartPulse,
  PillBottle,
  Receipt,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAiForecast, getAllRoleForecasts, type AiForecastResponse } from '@/services/api/ai';

export function AdminAllForecastsOverview() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'all'],
    queryFn: getAllRoleForecasts,
    staleTime: 60_000,
  });

  const all = query.data ?? {};
  const hospital = (all.hospital ?? {}) as Record<string, unknown>;
  const doctor = (all.doctor ?? {}) as Record<string, unknown>;
  const nurse = (all.nurse ?? {}) as Record<string, unknown>;
  const lab = (all.laboratory ?? {}) as Record<string, unknown>;
  const pharmacy = (all.pharmacist ?? {}) as Record<string, unknown>;
  const cashier = (all.cashier ?? {}) as Record<string, unknown>;

  const labQueue = (lab.currentValue ?? {}) as Record<string, number>;
  const cashierFinancial = (cashier.currentValue ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
          <Sparkles className="h-4 w-4 text-blue-500" /> All Departments AI Forecast &amp; Operations
        </h3>
        <span className="text-xs text-muted-foreground">30-day projection snapshot</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Hospital Appointments */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Hospital Visits</span>
              <Activity className="h-3.5 w-3.5 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              {hospital.current30DayCount != null ? String(hospital.current30DayCount) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">
              Proj. next 30d: <strong className="text-foreground">{hospital.projectedNext30DayCount != null ? String(hospital.projectedNext30DayCount) : '—'}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Clinical Doctor */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Doctor Volume</span>
              <Stethoscope className="h-3.5 w-3.5 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              {doctor.current30DayCount != null ? String(doctor.current30DayCount) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">
              Projected: <strong className="text-foreground">{doctor.projectedNext30DayCount != null ? String(doctor.projectedNext30DayCount) : '—'}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Nurse Inpatient */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Active Inpatients</span>
              <HeartPulse className="h-3.5 w-3.5 text-purple-500" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              {nurse.currentValue != null ? String(nurse.currentValue) : '0'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">Assigned ward care</p>
          </CardContent>
        </Card>

        {/* Laboratory Queue */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Lab Queue</span>
              <Beaker className="h-3.5 w-3.5 text-cyan-500" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              {(labQueue.PENDING ?? 0) + (labQueue.IN_PROGRESS ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">
              {labQueue.PENDING ?? 0} pending · {labQueue.IN_PROGRESS ?? 0} active
            </p>
          </CardContent>
        </Card>

        {/* Pharmacy Batches */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Expiring Batches</span>
              <PillBottle className="h-3.5 w-3.5 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {pharmacy.currentValue != null ? String(pharmacy.currentValue) : '0'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">Expiring within 30 days</p>
          </CardContent>
        </Card>

        {/* Cashier Billing */}
        <Card className="border border-border bg-card shadow-sm hover:border-blue-500/50 transition">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Collections</span>
              <Wallet className="h-3.5 w-3.5 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-lg font-bold text-foreground truncate">
              {typeof cashierFinancial.totalCollected === 'number'
                ? `ETB ${cashierFinancial.totalCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-[11px]">
            <p className="text-muted-foreground">
              Billed: ETB {typeof cashierFinancial.totalBilled === 'number' ? cashierFinancial.totalBilled.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Doctor Role Clinical Forecast & Intelligence View */
export function DoctorClinicalForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'DOCTOR'],
    queryFn: () => getAiForecast('DOCTOR'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const current = Number(facts.current30DayCount ?? 0);
  const previous = Number(facts.previous30DayCount ?? 0);
  const projected = Number(facts.projectedNext30DayCount ?? current);
  const changeFraction = typeof facts.changeFraction === 'number' ? facts.changeFraction : 0;
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Current 30 Days</span>
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{current} visits</p>
          <p className="text-xs text-muted-foreground mt-1">Recorded consultations in past 30 days</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Previous 30 Days</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{previous} visits</p>
          <div className="flex items-center gap-1 mt-1 text-xs">
            {changeFraction >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3 w-3" /> +{(changeFraction * 100).toFixed(1)}%
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center">
                <ArrowDownRight className="h-3 w-3" /> {(changeFraction * 100).toFixed(1)}%
              </span>
            )}
            <span className="text-muted-foreground">vs prior period</span>
          </div>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Projected Next 30 Days</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{projected} visits</p>
          <p className="text-xs text-muted-foreground mt-1">Deterministic baseline extrapolation</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Clinical Recommendations
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Inpatient & Nursing Care Operational Forecast View */
export function InpatientNurseForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'NURSE'],
    queryFn: () => getAiForecast('NURSE'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const assigned = Number(facts.currentValue ?? 0);
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Active Inpatients</span>
            <HeartPulse className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{assigned} patients</p>
          <p className="text-xs text-muted-foreground mt-1">Currently assigned inpatient care</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Ward Status</span>
            <BedDouble className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">Active</p>
          <p className="text-xs text-muted-foreground mt-1">Routine vitals &amp; observation rounds</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Workload Horizon</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">Next 30 Days</p>
          <p className="text-xs text-muted-foreground mt-1">Continuous nursing monitoring</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Nursing Care Suggestions
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Pharmacy Inventory & Expiry Forecast View */
export function PharmacyInventoryForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'PHARMACIST'],
    queryFn: () => getAiForecast('PHARMACIST'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const expiring = Number(facts.currentValue ?? 0);
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Expiring Batches</span>
            <PillBottle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{expiring} batches</p>
          <p className="text-xs text-muted-foreground mt-1">Expiry date within the next 30 days</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Stock Turn</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">Active Rotation</p>
          <p className="text-xs text-muted-foreground mt-1">First-Expiry, First-Out (FEFO) protocol</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Forecast Status</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">Verified</p>
          <p className="text-xs text-muted-foreground mt-1">From PostgreSQL stock_batches table</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Pharmacy Inventory Suggestions
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Laboratory Queue & Turnaround Forecast View */
export function LaboratoryForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'LAB_TECHNICIAN'],
    queryFn: () => getAiForecast('LAB_TECHNICIAN'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const statuses = (facts.currentValue ?? {}) as Record<string, number>;
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  const pending = statuses.PENDING ?? 0;
  const inProgress = statuses.IN_PROGRESS ?? 0;
  const completed = statuses.COMPLETED ?? 0;
  const total = pending + inProgress + completed;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Pending Orders</span>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{pending}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting specimen collection</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">In Progress</span>
          <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgress}</p>
          <p className="text-xs text-muted-foreground mt-1">Active lab processing</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Completed</span>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completed}</p>
          <p className="text-xs text-muted-foreground mt-1">Verified test reports</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Total Processed</span>
          <p className="mt-2 text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">All recorded orders</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-cyan-500" /> Laboratory Queue Suggestions
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Cashier & Billing Financial Forecast View */
export function CashierBillingForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'CASHIER'],
    queryFn: () => getAiForecast('CASHIER'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const financial = (facts.currentValue ?? {}) as Record<string, unknown>;
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  const totalBilled = typeof financial.totalBilled === 'number' ? financial.totalBilled : 0;
  const totalCollected = typeof financial.totalCollected === 'number' ? financial.totalCollected : 0;
  const outstanding = typeof financial.outstandingBalance === 'number' ? financial.outstandingBalance : 0;
  const count = typeof financial.invoiceCount === 'number' ? financial.invoiceCount : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Total Billed</span>
          <p className="mt-2 text-xl font-bold text-foreground">
            ETB {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{count} invoices issued</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Total Collected</span>
          <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            ETB {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Confirmed cash &amp; transfer payments</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Outstanding</span>
          <p className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
            ETB {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting patient settlement</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <span className="text-xs uppercase font-medium text-muted-foreground">Collection Ratio</span>
          <p className="mt-2 text-xl font-bold text-foreground">
            {totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '100'}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Settlement rate</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Billing Suggestions
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Reception & Front Desk Patient Volume Forecast View */
export function ReceptionistForecastView() {
  const query = useQuery({
    queryKey: ['ai', 'forecast', 'RECEPTIONIST'],
    queryFn: () => getAiForecast('RECEPTIONIST'),
    staleTime: 60_000,
  });

  const facts = query.data?.facts ?? {};
  const registrations = Number(facts.patientRegistrations30Days ?? 0);
  const appointments = Number(facts.bookedAppointments30Days ?? 0);
  const suggestions = (Array.isArray(facts.suggestions) ? facts.suggestions : []) as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">New Registrations</span>
            <UserRound className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{registrations} patients</p>
          <p className="text-xs text-muted-foreground mt-1">Newly enrolled in past 30 days</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Appointments Booked</span>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{appointments} visits</p>
          <p className="text-xs text-muted-foreground mt-1">Scheduled appointments</p>
        </Card>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-medium text-muted-foreground">Desk Efficiency</span>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">Active</p>
          <p className="text-xs text-muted-foreground mt-1">Real-time check-in &amp; assignment</p>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Front Desk Suggestions
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
