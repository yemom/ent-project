'use client';
import { Building2, CalendarCheck, CheckCircle2, Filter, KeyRound, PillBottle, Search, Shield, ShieldCheck, Sparkles, UserPlus, Users, XCircle } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { ROUTES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OverviewChart } from '@/components/charts/overview-chart';
import { PageHeader } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import {
  createDoctor,
  createPatient,
  deletePatient,
  inviteUser,
  updatePatient,
} from "@/services/api/admin";
import { listUsers, listDoctors, listPatients } from '@/services/api/users';
import { listAppointments } from '@/services/api/appointments';
import { listPrescriptionOrders, updatePrescriptionOrderStatus } from '@/features/prescriptions';
import { useRouter, useSearchParams } from 'next/navigation';

function formatAppointmentTime(value?: string) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function formatLastLogin(value?: string) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function useUrlQuery() {
  const searchParams = useSearchParams();
  return searchParams.get('q') ?? '';
}

function MetricCards() {
  const [stats, setStats] = useState({
    patients: '...',
    appointments: '...',
    revenue: '$14,200', // Still static as we don't have a revenue API
    occupancy: '88%' // Still static
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [patientsRes, appointmentsRes] = await Promise.all([
          listPatients({ size: 1000 }),
          listAppointments({ size: 1000 })
        ]);
        setStats(prev => ({
          ...prev,
          patients: (patientsRes.content ?? []).length.toString(),
          appointments: (appointmentsRes.content ?? []).length.toString()
        }));
      } catch (err) {
        // Silent fail - dashboard is non-blocking
      }
    }
    fetchStats();
  }, []);

  const activity = [
    { label: 'Total Patients', value: stats.patients, delta: '+12%' },
    { label: 'Appointments', value: stats.appointments, delta: 'Today' },
    { label: 'Daily Revenue', value: stats.revenue, delta: '+$2.4k' },
    { label: 'Occupancy', value: stats.occupancy, delta: 'High' }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {activity.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardHeader className="space-y-4 pb-3">
            <div className="flex items-center justify-between text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              <span>{item.delta}</span>
            </div>
            <CardDescription className="text-xs uppercase tracking-[0.18em]">{item.label}</CardDescription>
            <CardTitle className="text-3xl">{item.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function UpcomingAppointmentsPanel() {
  const [appointments, setAppointments] = useState<Array<{ id: string; patientName: string; doctorName: string; scheduledAt: string; status: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listAppointments({ size: 8 });
        const items = (data.content ?? []).map((appointment) => ({
          id: appointment.id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          scheduledAt: appointment.scheduledAt,
          status: appointment.status
        }));
        setAppointments(items.sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Upcoming Appointments</CardTitle>
          <CardDescription>Live clinic schedule from the backend</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { window.location.href = ROUTES.adminAppointments; }}>
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No upcoming appointments found.</div>
        ) : (
          appointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
              <div>
                <p className="font-medium">{appointment.patientName}</p>
                <p className="text-sm text-muted-foreground">{appointment.doctorName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatAppointmentTime(appointment.scheduledAt)}</p>
                <Badge variant={appointment.status === 'CONFIRMED' ? 'success' : appointment.status === 'PENDING' ? 'warning' : 'outline'} className="mt-2">
                  {appointment.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function OnSiteSpecialistsPanel() {
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string; specialization?: string; status?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listDoctors({ size: 8 });
        setDoctors((data.content ?? []).map((doctor) => ({
          id: doctor.id,
          fullName: doctor.fullName,
          specialization: (doctor as any).specialization,
          status: doctor.status
        })));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>On-Site Specialists</CardTitle>
        <CardDescription>Currently active providers pulled from the live registry</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : doctors.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No specialists found.</div>
        ) : (
          doctors.map((doctor) => (
            <div key={doctor.id} className="rounded-2xl bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{doctor.fullName}</p>
                  <p className="text-sm text-muted-foreground">{doctor.specialization || 'Specialist'}</p>
                </div>
                <Badge variant={doctor.status === 'ACTIVE' ? 'success' : 'outline'}>{doctor.status || 'ACTIVE'}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AdminDashboardPage
// 
// This page provides a high-level overview of the clinic's operations.
// It includes key performance indicators (KPIs) and system health status.
// Currently, some data is static but can be wired up to an admin stats endpoint.
// ============================================================================
export function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" description="Monitor clinic operations, providers, and patient throughput in one command center." actionLabel="Add New User" actionHref={ROUTES.adminInviteUser} />
      <MetricCards />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <UpcomingAppointmentsPanel />
          <OverviewChart />
        </div>
        <div className="space-y-6">
          <OnSiteSpecialistsPanel />
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Live operational summary and policy controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-medium">JWT Auth</p>
                  <p className="text-xs text-muted-foreground">Refresh rotation enabled</p>
                </div>
                <Badge variant="success">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-medium">Appointments</p>
                  <p className="text-xs text-muted-foreground">No conflict spikes detected</p>
                </div>
                <Badge variant="warning">Watch</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-medium">Audit Events</p>
                  <p className="text-xs text-muted-foreground">Role permissions synchronized</p>
                </div>
                <Badge variant="outline">Synced</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AdminUsersPage
// 
// Displays a directory of all registered users (staff, admins, and patients).
// It fetches real data from the backend to present current user statuses and roles.
// ============================================================================
export function AdminUsersPage() {
  const urlQuery = useUrlQuery();
  const [users, setUsers] = useState<Array<{ name: string; email: string; role: string; status: string; lastLogin: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter((user) => [user.name, user.email, user.role, user.status].some((value) => value.toLowerCase().includes(q)));
  }, [query, users]);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listUsers({ size: 30 });
        setUsers((data.content ?? []).map((u) => ({
          name: u.fullName,
          email: u.email,
          role: u.role,
          status: u.status,
          lastLogin: u.lastLogin ?? 'Never'
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Search, filter, and manage staff and patient accounts." actionLabel="Invite User" actionHref={ROUTES.adminInviteUser} />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Staff and patient records</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input className="max-w-xs" placeholder="Search users..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button variant="outline"><Filter className="h-4 w-4" /> Filter</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.name}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                    <TableCell><Badge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>{user.status}</Badge></TableCell>
                    <TableCell>{user.lastLogin}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AdminDoctorsPage
// 
// This page manages the healthcare providers in the clinic.
// It lists active doctors by fetching them from the backend API.
// ============================================================================
export function AdminDoctorsPage() {
  const urlQuery = useUrlQuery();
  const [doctors, setDoctors] = useState<Array<{ name: string; email: string; role: string; status: string; specialization?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredDoctors = useMemo(() => {
    if (!query.trim()) return doctors;
    const q = query.toLowerCase();
    return doctors.filter((doctor) =>
      [doctor.name, doctor.email, doctor.role, doctor.status, doctor.specialization ?? ''].some((value) => value.toLowerCase().includes(q))
    );
  }, [doctors, query]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listDoctors({ size: 30 });
        setDoctors((data.content ?? []).map((d) => ({
          name: d.fullName,
          email: d.email,
          role: d.role,
          status: d.status,
          specialization: (d as any).specialization
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Doctor Management" description="Track providers, specialties, schedules, and access policies." actionLabel="Add Doctor" actionHref={ROUTES.adminAddDoctor} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Doctors</CardTitle>
            <CardDescription>Availability, specialty, and workload</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 rounded-2xl border border-input bg-background p-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search doctors by name, email, specialty, or status..."
              />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </>
            ) : filteredDoctors.length === 0 ? (
              <div className="text-sm text-muted-foreground">No doctors found.</div>
            ) : (
              filteredDoctors.map((doc) => (
                <div key={doc.name} className="rounded-2xl bg-muted/50 p-4">
                  <p className="font-semibold">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">{doc.email}</p>
                  <p className="text-sm text-muted-foreground">{doc.specialization || doc.role}</p>
                  <Badge className="mt-2" variant={doc.status === 'ACTIVE' ? 'success' : 'secondary'}>{doc.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scheduling Rules</CardTitle>
            <CardDescription>Conflict prevention and capacity management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Overbook prevention</span>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Buffer between visits</span>
              <Badge variant="outline">15 min</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>After-hours booking</span>
              <Badge variant="warning">Restricted</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// AdminPatientsPage
// 
// This page manages patient records for administrators. It fetches the list
// of patients from the backend and displays both summary statistics and
// the actual patient list in a table.
// ============================================================================
export function AdminPatientsPage() {
  const urlQuery = useUrlQuery();
  const [patients, setPatients] = useState<Array<{ id: string; name: string; email: string; status: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPatient, setEditingPatient] = useState<{ id: string; name: string; email: string } | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredPatients = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.toLowerCase();
    return patients.filter((patient) => [patient.name, patient.email, patient.status].some((value) => value.toLowerCase().includes(q)));
  }, [patients, query]);

  // Fetch real patient data on component mount
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await listPatients({ size: 30 });
      setPatients((data.content ?? []).map((p) => ({
        id: p.id,
        name: p.fullName,
        email: p.email,
        status: p.status
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this patient?')) return;
    try {
      await deletePatient(id);
      setStatus('success');
      setStatusMessage('Patient deleted successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'We could not delete this patient right now. Please try again.'));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    try {
      await updatePatient(editingPatient.id, {
        fullName: editingPatient.name,
        email: editingPatient.email
      });
      setEditingPatient(null);
      setStatus('success');
      setStatusMessage('Patient updated successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'We could not update this patient right now. Please try again.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Patient Management" description="Review patient engagement, care plans, and follow-up status." actionLabel="Import Patients" actionHref={ROUTES.adminImportPatients} />
      
      <StatusAlert 
        status={status} 
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss={true}
        autoDismissMs={3500}
      />
      
      {editingPatient && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Edit Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input 
                    value={editingPatient.name} 
                    onChange={e => setEditingPatient({...editingPatient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input 
                    value={editingPatient.email} 
                    onChange={e => setEditingPatient({...editingPatient, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setEditingPatient(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Patient Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Summary</CardTitle>
          <CardDescription>Care coordination and risk view</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-sm text-muted-foreground">No patients found.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-primary/10 p-4">
                <p className="text-sm font-semibold">Total Patients</p>
                <p className="text-2xl font-bold mt-2">{patients.length}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold">Active</p>
                <p className="text-2xl font-bold mt-2">{patients.filter(p => p.status === 'ACTIVE').length}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold">Pending</p>
                <p className="text-2xl font-bold mt-2">{patients.filter(p => p.status !== 'ACTIVE').length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actual Patient List Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Patient List</CardTitle>
              <CardDescription>Detailed directory of all registered patients</CardDescription>
            </div>
            <div className="flex min-w-64 gap-3 rounded-2xl border border-input bg-background p-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search patients..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-sm text-muted-foreground">No patients found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>{patient.email}</TableCell>
                    <TableCell>
                      <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingPatient(patient)}>Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => (window.location.href = `/admin/patients/${patient.id}`)}>View</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(patient.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AdminAppointmentsPage
// 
// Allows administrators to monitor all appointments happening across the clinic.
// Fetches the real appointment queue and displays statuses like PENDING or CONFIRMED.
// ============================================================================
export function AdminAppointmentsPage() {
  const urlQuery = useUrlQuery();
  const [appointments, setAppointments] = useState<Array<{ time: string; patient: string; doctor: string; status: string; reason: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredAppointments = useMemo(() => {
    if (!query.trim()) return appointments;
    const q = query.toLowerCase();
    return appointments.filter((appointment) =>
      [appointment.time, appointment.patient, appointment.doctor, appointment.status, appointment.reason].some((value) => value.toLowerCase().includes(q))
    );
  }, [appointments, query]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listAppointments({ size: 30 });
        setAppointments((data.content ?? []).map((a) => ({
          time: new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          patient: a.patientName,
          doctor: a.doctorName,
          status: a.status,
          reason: a.reason || ''
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Appointment Monitoring" description="Real-time schedule review with conflict prevention and status tracking." actionLabel="Create Appointment" actionHref={ROUTES.adminCreateAppointment} />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Today's queue</CardTitle>
              <CardDescription>Appointment states and room usage</CardDescription>
            </div>
            <div className="flex min-w-64 gap-3 rounded-2xl border border-input bg-background p-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search appointments..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No appointments scheduled.</div>
          ) : (
            filteredAppointments.map((apt, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <span className="font-medium">{apt.time} - {apt.patient}</span>
                  <p className="text-sm text-muted-foreground">{apt.doctor}{apt.reason ? ` • ${apt.reason}` : ''}</p>
                </div>
                <Badge variant={apt.status === 'CONFIRMED' ? 'success' : apt.status === 'IN_PROGRESS' ? 'default' : apt.status === 'PENDING' ? 'warning' : 'destructive'}>
                  {apt.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AdminPharmacyPage
//
// Gives admins a live pharmacy overview with pharmacist accounts and the
// current prescription queue pulled from the backend.
// ============================================================================
export function AdminPharmacyPage() {
  const urlQuery = useUrlQuery();
  const [pharmacists, setPharmacists] = useState<Array<{ id: string; name: string; email: string; status: string }>>([]);
  const [orders, setOrders] = useState<Array<{ id: string; patientName: string; doctorName: string; drugName: string; dosage: string; status: 'PENDING' | 'DISPENSED' | 'REJECTED'; orderedAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  async function fetchData() {
    try {
      setIsLoading(true);
      const [usersData, ordersData] = await Promise.all([
        listUsers({ size: 100 }),
        listPrescriptionOrders({ size: 100 })
      ]);
      setPharmacists((usersData.content ?? [])
        .filter((user) => user.role === 'PHARMACIST')
        .map((user) => ({
          id: user.id,
          name: user.fullName,
          email: user.email,
          status: user.status ?? 'ACTIVE'
        })));
      setOrders((ordersData.content ?? []).map((order: any) => ({
        id: order.id,
        patientName: order.patientName,
        doctorName: order.doctorName,
        drugName: order.drugName,
        dosage: order.dosage,
        status: order.status,
        orderedAt: order.orderedAt
      })));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPharmacists = useMemo(() => {
    if (!query.trim()) return pharmacists;
    const q = query.toLowerCase();
    return pharmacists.filter((pharmacist) => [pharmacist.name, pharmacist.email, pharmacist.status].some((value) => value.toLowerCase().includes(q)));
  }, [pharmacists, query]);

  const filteredOrders = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.toLowerCase();
    return orders.filter((order) =>
      [order.patientName, order.doctorName, order.drugName, order.dosage, order.status].some((value) => value.toLowerCase().includes(q))
    );
  }, [orders, query]);

  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const dispensedCount = orders.filter((order) => order.status === 'DISPENSED').length;

  const handleOrderStatus = async (id: string, nextStatus: 'DISPENSED' | 'REJECTED') => {
    try {
      setUpdatingId(id);
      await updatePrescriptionOrderStatus(id, { status: nextStatus });
      setOrders((current) => current.map((order) => order.id === id ? { ...order, status: nextStatus } : order));
      setStatus('success');
      setStatusMessage(`Prescription marked as ${nextStatus.toLowerCase()}.`);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'We could not update the prescription order right now.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy Management"
        description="Manage pharmacist accounts and monitor the live prescription queue."
        actionLabel="Add Pharmacist"
        actionHref={ROUTES.adminInviteUser}
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pharmacists</CardTitle>
            <CardDescription>Real pharmacy staff accounts</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-teal-700">{pharmacists.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Queue</CardTitle>
            <CardDescription>Awaiting fulfillment</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-amber-600">{pendingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dispensed</CardTitle>
            <CardDescription>Completed prescription orders</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{dispensedCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Pharmacy Search</CardTitle>
            <CardDescription>Search pharmacists, prescriptions, patients, doctors, or order status.</CardDescription>
          </div>
          <div className="flex min-w-72 gap-3 rounded-2xl border border-input bg-background p-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder="Search pharmacy..."
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pharmacist Directory</CardTitle>
            <CardDescription>Accounts with pharmacy access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </>
            ) : filteredPharmacists.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No pharmacists found.</div>
            ) : (
              filteredPharmacists.map((pharmacist) => (
                <div key={pharmacist.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                  <div>
                    <p className="font-semibold">{pharmacist.name}</p>
                    <p className="text-sm text-muted-foreground">{pharmacist.email}</p>
                  </div>
                  <Badge variant={pharmacist.status === 'ACTIVE' ? 'success' : 'secondary'}>{pharmacist.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prescription Queue</CardTitle>
            <CardDescription>Real prescription orders from doctors.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No prescription orders found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.patientName}</TableCell>
                      <TableCell>{order.drugName} {order.dosage}</TableCell>
                      <TableCell>{order.doctorName}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'PENDING' ? 'warning' : order.status === 'DISPENSED' ? 'success' : 'destructive'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" disabled={updatingId === order.id} onClick={() => handleOrderStatus(order.id, 'DISPENSED')}>
                              Dispense
                            </Button>
                            <Button size="sm" variant="destructive" disabled={updatingId === order.id} onClick={() => handleOrderStatus(order.id, 'REJECTED')}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{new Date(order.orderedAt).toLocaleDateString()}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// AdminAnalyticsPage
// 
// Provides charts and analytics to visualize clinic performance.
// (Currently uses mock data for the OverviewChart)
// ============================================================================
export function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" description="Operational trends, revenue, and utilization visualized for executives." />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <OverviewChart />
        <Card>
          <CardHeader>
            <CardTitle>Key Signals</CardTitle>
            <CardDescription>Snapshot across clinic KPIs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Appointment fill rate</span>
              <Badge variant="success">92%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>No-show rate</span>
              <Badge variant="warning">4.1%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg. wait time</span>
              <Badge variant="outline">12 min</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// AdminSettingsPage
// 
// Configuration page for clinic-wide settings such as notifications and security.
// ============================================================================
export function AdminSettingsPage() {
  const urlQuery = useUrlQuery();
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string; status: string; lastLogin?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listUsers({ size: 100 });
        setUsers((data.content ?? []).map((user) => ({
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          lastLogin: user.lastLogin
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const roleCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const personnel = useMemo(() => {
    if (!query.trim()) return users.slice(0, 6);
    const q = query.toLowerCase();
    return users.filter((user) => [user.name, user.email, user.role, user.status].some((value) => value.toLowerCase().includes(q))).slice(0, 6);
  }, [query, users]);
  const roleCards = [
    {
      name: 'Administrator',
      role: 'ADMIN',
      description: 'Full system access, user management, and clinic policies.'
    },
    {
      name: 'Doctor',
      role: 'DOCTOR',
      description: 'Full patient records access, prescriptions, and notes.'
    },
    {
      name: 'Pharmacist',
      role: 'PHARMACIST',
      description: 'Prescription queue review and dispensing workflow.'
    },
    {
      name: 'Patient',
      role: 'PATIENT',
      description: 'Personal appointments, records, and prescriptions.'
    }
  ];

  const accessMatrix = [
    {
      title: 'Clinical Records',
      icon: ShieldCheck,
      color: 'text-teal-700',
      permissions: [
        ['EMR Access', true],
        ['Prescribe Meds', true],
        ['Lab Results', roleCounts.DOCTOR > 0]
      ]
    },
    {
      title: 'Administration',
      icon: Building2,
      color: 'text-orange-700',
      permissions: [
        ['User Directory', roleCounts.ADMIN > 0],
        ['Appointment Oversight', true],
        ['Patient Import', roleCounts.ADMIN > 0]
      ]
    },
    {
      title: 'Operations',
      icon: CalendarCheck,
      color: 'text-blue-700',
      permissions: [
        ['Calendar Mgmt', true],
        ['Prescription Queue', roleCounts.PHARMACIST > 0],
        ['Data Export', roleCounts.ADMIN > 0]
      ]
    },
    {
      title: 'User Security',
      icon: Shield,
      color: 'text-slate-700',
      permissions: [
        ['Edit Roles', roleCounts.ADMIN > 0],
        ['Audit Logs', roleCounts.ADMIN > 0],
        ['Deactivate Users', roleCounts.ADMIN > 0]
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex max-w-2xl items-center gap-3 rounded-full border border-border bg-white px-5 py-3 shadow-sm">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder="Search patients, records, or staff..."
            />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-normal text-slate-950">Access Management</h1>
            <p className="mt-2 max-w-3xl text-lg text-slate-700">
              Control organizational hierarchy and data visibility through role-based permissions.
            </p>
          </div>
        </div>
        <Button className="h-14 rounded-lg bg-teal-700 px-8 text-base font-bold hover:bg-teal-800" onClick={() => { window.location.href = ROUTES.adminInviteUser; }}>
          <UserPlus className="h-5 w-5" />
          Add New User
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        <Card className="rounded-lg border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-2xl">Active Personnel</CardTitle>
              <CardDescription>{users.length} real users loaded from the backend</CardDescription>
            </div>
            <Button variant="ghost" size="icon">
              <Filter className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : personnel.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No users found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-900">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full px-4 py-1">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-teal-600' : 'bg-slate-300'}`} />
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatLastLogin(user.lastLogin)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-lg border-0 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-2xl">Global Roles</CardTitle>
                <CardDescription>High-level access by current organization role.</CardDescription>
              </div>
              <Shield className="h-6 w-6 text-teal-700" />
            </CardHeader>
            <CardContent className="space-y-4">
              {roleCards.map((role) => {
                const enabled = (roleCounts[role.role] ?? 0) > 0;
                return (
                  <div key={role.role} className={`rounded-lg border p-4 ${enabled ? 'border-teal-700 bg-teal-50/40' : 'border-border bg-white'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">{role.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                      </div>
                      <div className={`flex h-6 w-12 items-center rounded-full p-1 ${enabled ? 'justify-end bg-teal-700' : 'justify-start bg-slate-200'}`}>
                        <span className="h-4 w-4 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Role Activity</CardTitle>
              <CardDescription>Recent security-related events from available data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Active Accounts Reviewed</p>
                  <p className="text-sm text-muted-foreground">{users.filter((user) => user.status === 'ACTIVE').length} active users in directory</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Role Coverage Check</p>
                  <p className="text-sm text-muted-foreground">{Object.keys(roleCounts).length} roles currently represented</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-lg border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl">Granular Access Matrix</CardTitle>
            <CardDescription>Specific data visibility per medical staff category.</CardDescription>
          </div>
          <div className="rounded-lg bg-muted p-1">
            <Button variant="secondary" size="sm" className="rounded-md">List View</Button>
            <Button variant="ghost" size="sm" className="rounded-md">Visual Graph</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {accessMatrix.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="space-y-5">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] ${group.color}`}>
                  <Icon className="h-5 w-5" />
                  {group.title}
                </div>
                <div className="space-y-4">
                  {group.permissions.map(([label, enabled]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3">
                      <span className={enabled ? 'text-slate-950' : 'text-muted-foreground'}>{label}</span>
                      {enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-teal-700" />
                      ) : (
                        <XCircle className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AdminRolesPage
// 
// Defines the role-based access control (RBAC) boundaries for the application.
// ============================================================================
export function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Role Permissions" description="Control access boundaries and service scopes across the platform." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
            <CardDescription>Full system access</CardDescription>
          </CardHeader>
          <CardContent>Manage users, roles, billing, and clinic policies.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Doctor</CardTitle>
            <CardDescription>Clinical workflow</CardDescription>
          </CardHeader>
          <CardContent>View patients, manage records, write prescriptions.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Patient</CardTitle>
            <CardDescription>Personal care portal</CardDescription>
          </CardHeader>
          <CardContent>Book visits, review records, and track prescriptions.</CardContent>
        </Card>
      </div>
    </div>
  );
}
