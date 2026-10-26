'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Beaker,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  PillBottle,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layouts/page-header';
import { OverviewChart } from '@/components/layouts/lazy-components';
import { useHospitalStats } from '@/features/admin/use-hospital-stats';
import { PERMISSIONS, type Permission } from '@/features/auth/permissions';
import { useAuthStore } from '@/store/auth-store';
import type { HospitalStats } from '@/services/api/stats';
import { AiExecutiveDashboard } from '@/features/ai/ai-executive-dashboard';

/**
 * Super Admin dashboard.
 *
 * <p>Every figure on this screen comes from `GET /stats/hospital`, which
 * aggregates the database directly. There are no estimates, no seed tables and no
 * placeholder numbers: a card showing 0 means the database really has 0.
 *
 * <p>Clinical detail is deliberately summarised, not exposed. SUPER_ADMIN holds
 * `report:read` but not `diagnosis:write` or `invoice:read`, so the API refuses
 * those reads — this dashboard stays inside what the role may actually see.
 */

export function SuperAdminDashboardPage() {
  const { data, isLoading, error } = useHospitalStats();

  // Typed as Partial so the empty fallback is explicit rather than inferred as {},
  // which would erase every property from the union.
  const pharmacy: Partial<HospitalStats['pharmacy']> = data?.pharmacy ?? {};
  const laboratory: Partial<HospitalStats['laboratory']> = data?.laboratory ?? {};

  const money = (value: unknown) =>
    typeof value === 'number' ? value.toFixed(2) : '...';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin"
        description="Every module's live position, straight from the database."
      />

      {error ? (
        <Card>
          <CardContent className="text-sm text-destructive">
            The dashboard could not be loaded. Check that the API is reachable and that this
            account holds <span className="font-mono">report:read</span>.
          </CardContent>
        </Card>
      ) : null}

      {/* ── Role Switcher & AI Intelligence Workspace matching StockFlow ── */}
      <AiExecutiveDashboard />

      {/* ---------------- people ---------------- */}
      <Section title="People" icon={Users} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total accounts" value={data?.totalUsers} loading={isLoading} icon={Users} />
        <Stat
          label="Active accounts"
          value={data?.activeUsers}
          loading={isLoading}
          icon={ShieldCheck}
        />
        <Stat label="Patients" value={data?.totalPatients} loading={isLoading} icon={UserRound} />
        <Stat
          label="Doctors"
          value={data?.totalDoctors}
          loading={isLoading}
          icon={Stethoscope}
        />
        <Stat label="Nurses" value={data?.totalNurses} loading={isLoading} icon={HeartPulse} />
        <Stat
          label="Live assignments"
          value={data?.activeAssignments}
          loading={isLoading}
          icon={ClipboardList}
        />
        <Stat
          label="Medical records"
          value={data?.medicalRecords}
          loading={isLoading}
          icon={FileText}
        />
        <Stat
          label="Signed records"
          value={data?.signedMedicalRecords}
          loading={isLoading}
          icon={FileText}
        />
      </div>

      <RoleBreakdown byRole={data?.usersByRole} loading={isLoading} />

      {/* ---------------- clinical operations ---------------- */}
      <Section title="Clinical operations" icon={Activity} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Appointments"
          value={data?.totalAppointments}
          loading={isLoading}
          icon={CalendarDays}
        />
        <Stat
          label="Today"
          value={data?.appointmentsToday}
          loading={isLoading}
          icon={CalendarDays}
        />
        <Stat
          label="Open admissions"
          value={data?.openAdmissions}
          loading={isLoading}
          icon={BedDouble}
        />
        <Stat
          label="Nursing observations"
          value={data?.nurseObservations}
          loading={isLoading}
          icon={HeartPulse}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Appointment volume
            </CardTitle>
            <CardDescription>Daily counts from the appointments table.</CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewChart />
          </CardContent>
        </Card>

        <LaboratoryPanel laboratory={laboratory} isLoading={isLoading} />
      </div>

      <AppointmentStatusPanel byStatus={data?.appointmentsByStatus} loading={isLoading} />

      {/* ---------------- wards ---------------- */}
      <Section title="Departments, wards and beds" icon={Building2} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Departments"
          value={data?.departments}
          loading={isLoading}
          icon={Building2}
        />
        <Stat label="Wards" value={data?.wards} loading={isLoading} icon={ClipboardList} />
        <Stat label="Rooms" value={data?.rooms} loading={isLoading} icon={BedDouble} />
        <Stat
          label="Rooms available"
          value={data?.roomsAvailable}
          loading={isLoading}
          icon={BedDouble}
        />
      </div>

      {/* ---------------- pharmacy ---------------- */}
      <Section title="Pharmacy" icon={PillBottle} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Medicines"
          value={pharmacy.medicines as number | undefined}
          loading={isLoading}
          icon={PillBottle}
        />
        <Stat
          label="Suppliers"
          value={pharmacy.suppliers as number | undefined}
          loading={isLoading}
          icon={Building2}
        />
        <Stat
          label="Stock value"
          text={money(pharmacy.stockValue)}
          loading={isLoading}
          icon={Wallet}
        />
        <Stat
          label="Dispensed (COGS)"
          text={money(pharmacy.costOfGoodsDispensedInPeriod)}
          loading={isLoading}
          icon={ArrowRight}
        />
      </div>

      <PharmacyAlertPanel pharmacy={pharmacy} loading={isLoading} />

      {/* ---------------- finance ---------------- */}
      <Section title="Finance" icon={Receipt} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Invoices"
          value={data?.invoices}
          loading={isLoading}
          icon={Receipt}
        />
        <Stat
          label="Total billed"
          text={money(data?.totalBilled)}
          loading={isLoading}
          icon={Receipt}
        />
        <Stat
          label="Total collected"
          text={money(data?.totalCollected)}
          loading={isLoading}
          icon={Wallet}
        />
        <Stat
          label="Refunds awaiting approval"
          value={data?.refundsPendingApproval}
          loading={isLoading}
          icon={AlertTriangle}
          alert={(data?.refundsPendingApproval ?? 0) > 0}
        />
      </div>

      <NavigationGrid />
    </div>
  );
}

// ---------------------------------------------------------------- panels

function Section({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      <Icon className="h-4 w-4" />
      {title}
    </h2>
  );
}

function Stat({
  label,
  value,
  text,
  icon: Icon,
  loading,
  alert,
}: {
  label: string;
  value?: number;
  text?: string;
  icon: LucideIcon;
  loading?: boolean;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive/50' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl">
          {loading ? '...' : (text ?? value ?? 0)}
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function RoleBreakdown({
  byRole,
  loading,
}: {
  byRole?: Record<string, number>;
  loading?: boolean;
}) {
  const rows = useMemo(
    () =>
      Object.entries(byRole ?? {})
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a),
    [byRole]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Accounts by role
        </CardTitle>
        <CardDescription>Counted from the users table, grouped by role.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rows.map(([role, count]) => (
              <Badge key={role} variant="outline">
                {role.replace(/_/g, ' ')} · {count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LaboratoryPanel({
  laboratory,
  isLoading,
}: {
  laboratory: Record<string, unknown>;
  isLoading?: boolean;
}) {
  const rows: Array<{ label: string; value: unknown }> = [
    { label: 'Lab orders', value: laboratory.orders },
    { label: 'Pending orders', value: laboratory.pendingOrders },
    { label: 'Results recorded', value: laboratory.results },
    { label: 'Final results', value: laboratory.finalResults },
    { label: 'Critical results', value: laboratory.criticalResults },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-4 w-4" /> Laboratory
        </CardTitle>
        <CardDescription>Critical results need clinician attention regardless of status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
            <span className="text-sm">{row.label}</span>
            <Badge
              variant={
                row.label === 'Critical results' && Number(row.value) > 0 ? 'destructive' : 'outline'
              }
            >
              {isLoading ? '...' : (row.value as number) ?? 0}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AppointmentStatusPanel({
  byStatus,
  loading,
}: {
  byStatus?: Record<string, number>;
  loading?: boolean;
}) {
  const rows = Object.entries(byStatus ?? {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" /> Appointments by status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rows.map(([status, count]) => (
              <Badge key={status} variant="outline">
                {status} · {count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PharmacyAlertPanel({
  pharmacy,
  loading,
}: {
  pharmacy: Record<string, unknown>;
  loading?: boolean;
}) {
  const alerts: Array<{ label: string; value: unknown; tone: 'destructive' | 'warning' | 'outline' }> = [
    { label: 'Out of stock', value: pharmacy.outOfStock, tone: 'destructive' },
    { label: 'Low stock', value: pharmacy.lowStock, tone: 'warning' },
    { label: 'Expiring soon', value: pharmacy.expiringSoon, tone: 'warning' },
    { label: 'Expired on shelf', value: pharmacy.expired, tone: 'destructive' },
  ];

  const movements = (pharmacy.movementsByKind ?? {}) as Record<string, number>;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Stock alerts
          </CardTitle>
          <CardDescription>Expired lots are excluded from live stock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((alert) => {
            const count = Number(alert.value ?? 0);
            return (
              <div key={alert.label} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
                <span className="text-sm">{alert.label}</span>
                <Badge variant={count > 0 && alert.tone !== 'outline' ? alert.tone : 'success'}>
                  {loading ? '...' : count}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PillBottle className="h-4 w-4" /> Movement ledger
          </CardTitle>
          <CardDescription>Append-only history of every stock change.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full rounded-2xl" />
          ) : Object.keys(movements).length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(movements).map(([kind, count]) => (
                <Badge key={kind} variant="outline">
                  {kind} · {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Working links into the management pages this dashboard summarises.
 *
 * <p>Each link is gated on the permission its page requires, so the grid never
 * offers a destination that would come back 403. SUPER_ADMIN sees the platform
 * pages but not, for example, the patient directory, which needs a permission it
 * deliberately does not hold.
 */
function NavigationGrid() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const links: Array<{ href: string; label: string; icon: LucideIcon; permission: Permission }> = [
    { href: '/admin/users', label: 'Users', icon: Users, permission: PERMISSIONS.USER_MANAGE },
    { href: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: PERMISSIONS.ROLE_MANAGE },
    {
      href: '/admin/patients',
      label: 'Patients',
      icon: UserRound,
      permission: PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
    },
    {
      href: '/admin/appointments',
      label: 'Appointments',
      icon: CalendarDays,
      permission: PERMISSIONS.APPOINTMENT_MANAGE,
    },
    {
      href: '/admin/doctors',
      label: 'Doctors',
      icon: Stethoscope,
      permission: PERMISSIONS.STAFF_MANAGE,
    },
    {
      href: '/admin/doctor-availability',
      label: 'Availability',
      icon: CalendarDays,
      permission: PERMISSIONS.STAFF_MANAGE,
    },
    {
      href: '/admin/pharmacy',
      label: 'Pharmacy',
      icon: PillBottle,
      permission: PERMISSIONS.REPORT_READ,
    },
    { href: '/admin/audit-log', label: 'Audit log', icon: FileText, permission: PERMISSIONS.AUDIT_READ },
  ];

  const available = links.filter((link) => hasPermission(link.permission));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Go to</CardTitle>
        <CardDescription>Only the pages this role is permitted to open.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {available.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-sm font-medium transition hover:bg-muted"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}