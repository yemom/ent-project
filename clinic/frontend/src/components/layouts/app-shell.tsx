'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, Bell, CalendarDays, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, MoonStar, PillBottle, Settings, ShieldCheck, Stethoscope, UserRound, UserRoundSearch, Users, Beaker, Clock } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/store/auth-store';

const navByRole = {
  ADMIN: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Doctors', href: '/admin/doctors', icon: Stethoscope },
    { label: 'Patients', href: '/admin/patients', icon: UserRound },
    { label: 'Laboratories', href: '/admin/laboratories', icon: Beaker },
    { label: 'Doctor Availability', href: '/admin/doctor-availability', icon: Clock },
    { label: 'Pharmacy', href: '/admin/pharmacy', icon: PillBottle },
    { label: 'Appointments', href: '/admin/appointments', icon: CalendarDays },
    { label: 'Analytics', href: '/admin/analytics', icon: Activity },
    { label: 'Role Permissions', href: '/admin/roles', icon: ShieldCheck },
    { label: 'Settings', href: '/admin/settings', icon: Settings }
  ],
  DOCTOR: [
    { label: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
    { label: 'Appointments', href: '/doctor/appointments', icon: CalendarDays },
    { label: 'Patient History', href: '/doctor/patients', icon: UserRoundSearch },
    { label: 'Records', href: '/doctor/records/new', icon: ClipboardList },
    { label: 'Lab Investigations', href: '/doctor/laboratory', icon: Beaker },
    { label: 'Prescriptions', href: '/doctor/prescriptions/new', icon: PillBottle },
    { label: 'Availability', href: '/doctor/availability', icon: Activity },
    { label: 'Schedule', href: '/doctor/schedule', icon: CalendarDays },
    { label: 'Settings', href: '/doctor/settings', icon: Settings }
  ],
  PATIENT: [
    { label: 'Dashboard', href: '/patient', icon: LayoutDashboard },
    { label: 'Book Appointment', href: '/patient/book-appointment', icon: CalendarDays },
    { label: 'Appointment History', href: '/patient/appointments', icon: ClipboardList },
    { label: 'Medical Records', href: '/patient/records', icon: FileText },
    { label: 'Prescriptions', href: '/patient/prescriptions', icon: PillBottle },
    { label: 'Profile', href: '/patient/profile', icon: UserRound },
    { label: 'Notifications', href: '/patient/notifications', icon: Bell },
    { label: 'Settings', href: '/patient/settings', icon: Settings }
  ],
  PHARMACIST: [
    { label: 'Dashboard', href: '/pharmacist/dashboard', icon: LayoutDashboard },
    { label: 'Orders', href: '/pharmacist/orders', icon: PillBottle },
    { label: 'Profile', href: '/pharmacist/profile', icon: UserRound },
    { label: 'Settings', href: '/pharmacist/settings', icon: Settings }
  ]
  ,
  LABORATORY: [
    { label: 'Dashboard', href: '/laboratory', icon: LayoutDashboard },
    { label: 'Orders', href: '/laboratory/orders', icon: ClipboardList },
    { label: 'Results', href: '/laboratory/results', icon: FileText },
    { label: 'Profile', href: '/laboratory/profile', icon: UserRound }
  ]
} as const;

function roleLabel(role?: string | null) {
  if (!role) return 'Guest';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const visibleNav = useMemo(() => {
    if (user?.role === 'DOCTOR') return navByRole.DOCTOR;
    if (user?.role === 'LABORATORY') return navByRole.LABORATORY;
    if (user?.role === 'PATIENT') return navByRole.PATIENT;
    if (user?.role === 'PHARMACIST') return navByRole.PHARMACIST;
    return navByRole.ADMIN;
  }, [user?.role]);

  const roleName = user?.role ?? (pathname.startsWith('/doctor') ? 'DOCTOR' : pathname.startsWith('/patient') ? 'PATIENT' : pathname.startsWith('/pharmacist') ? 'PHARMACIST' : pathname.startsWith('/laboratory') ? 'LABORATORY' : 'ADMIN');

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  const handleSignOut = () => {
    clearSession();
    router.replace('/login');
  };

  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    const nextParams = new URLSearchParams(searchParams.toString());
    if (query) {
      nextParams.set('q', query);
    } else {
      nextParams.delete('q');
    }
    const nextQuery = nextParams.toString();
    router.push((nextQuery ? `${pathname}?${nextQuery}` : pathname) as never);
  };

  return (
    <div className="min-h-screen bg-clinic-gradient text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className={cn('border-r border-border/60 bg-white/80 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen', mobileOpen ? 'fixed inset-y-0 left-0 z-40 w-[280px] shadow-soft' : 'hidden lg:block')}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border/60 px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary overflow-hidden shadow-glow">
                <img src="/clinic_logo.png" alt="Clinic Logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">{APP_NAME}</div>
                <div className="text-xs text-muted-foreground">Healthcare suite</div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 px-4 py-5">
              {visibleNav.map((item) => {
                const active = item.href === '/doctor' || item.href === '/admin' || item.href === '/patient'
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                      active ? 'bg-primary text-primary-foreground shadow-glow' : 'text-slate-600 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {active ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/60 p-4">
              {roleName === 'ADMIN' ? (
                <Link
                  href={ROUTES.adminCreateAppointment}
                  className="inline-flex w-full items-center justify-start gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-95"
                >
                  <Activity className="h-4 w-4" />
                  New Appointment
                </Link>
              ) : user?.role === 'PHARMACIST' ? (
                <Link
                  href="/pharmacist/orders"
                  className="inline-flex w-full items-center justify-start gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-95"
                >
                  <PillBottle className="h-4 w-4" />
                  View Orders
                </Link>
              ) : null}
              <Button className="mt-3 w-full justify-start rounded-2xl" variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {mobileOpen ? <button aria-label="Close sidebar" className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-white/75 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden flex-1 items-center gap-3 rounded-full border border-border/60 bg-white px-4 py-2 shadow-sm md:flex">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Search patients, doctors, records..."
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  <MoonStar className="h-5 w-5" />
                </Button>
                <Badge variant="outline" className="hidden md:inline-flex">
                  {roleLabel(roleName)}
                </Badge>
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 shadow-sm">
                  <div className="h-9 w-9 rounded-full bg-primary/10" />
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold leading-none">{user?.fullName ?? 'Dr. Smith'}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel(roleName)}</div>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
