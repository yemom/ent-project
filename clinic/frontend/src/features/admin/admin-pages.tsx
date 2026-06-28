'use client';
import { ArrowLeft, Building2, CalendarCheck, CheckCircle2, Filter, KeyRound, PillBottle, Search, Shield, ShieldCheck, Sparkles, UserPlus, Users, XCircle, Beaker, Clock } from 'lucide-react';
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
  deleteUser,
  inviteUser,
  updatePatient,
  updateUser,
} from "@/services/api/admin";
import { listUsers, listDoctors, listPatients } from '@/services/api/users';
import { listAppointments } from '@/services/api/appointments';
import { listPrescriptionOrders, updatePrescriptionOrderStatus } from '@/features/prescriptions';
import { listLaboratories, getLaboratory, createLaboratory, updateLaboratory, deleteLaboratory, listDoctorAvailability, getDoctorAvailabilityByLaboratory, createDoctorAvailability, updateDoctorAvailability, deleteDoctorAvailability } from '@/services/api/laboratory';
import { labOrdersService } from '@/features/laboratory/services/lab-orders.service';
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
      } catch {
        setDoctors([]);
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
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; phone: string; role: string; status: string; lastLogin: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; email: string; phone: string; active: boolean } | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [query, setQuery] = useState(urlQuery);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter((user) => [user.name, user.email, user.role, user.status].some((value) => value.toLowerCase().includes(q)));
  }, [query, users]);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await listUsers({ size: 100 });
      setUsers((data.content ?? []).map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        phone: u.phone ?? '',
        role: u.role,
        status: u.status ?? (u.active === false ? 'OFFLINE' : 'ACTIVE'),
        lastLogin: u.lastLogin ?? 'Never'
      })));
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteUser(id);
      setStatus('success');
      setStatusMessage('User deleted successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'We could not delete this user right now. Please try again.'));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, {
        fullName: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone || undefined,
        active: editingUser.active,
      });
      setEditingUser(null);
      setStatus('success');
      setStatusMessage('User updated successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'We could not update this user right now. Please try again.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Search, filter, and manage staff and patient accounts." actionLabel="Invite User" actionHref={ROUTES.adminInviteUser} />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss={true}
        autoDismissMs={3500}
      />

      {editingUser && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>Update account details and status</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={editingUser.phone}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editingUser.active ? 'ACTIVE' : 'OFFLINE'}
                    onChange={(e) => setEditingUser({ ...editingUser, active: e.target.value === 'ACTIVE' })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="OFFLINE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
          ) : filteredUsers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                    <TableCell><Badge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>{user.status}</Badge></TableCell>
                    <TableCell>{user.lastLogin}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser({
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          phone: user.phone,
                          active: user.status === 'ACTIVE',
                        })}
                      >
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id, user.name)}>Delete</Button>
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
      } catch {
        setDoctors([]);
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
  const router = useRouter();
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
    } catch {
      setPatients([]);
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
                      <Button variant="outline" size="sm" onClick={() => router.push(`/admin/patients/${patient.id}`)}>View</Button>
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
      } catch {
        setAppointments([]);
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
      const usersData = await listUsers({ size: 100 });
      let ordersData: any = { content: [] };
      try {
        ordersData = await listPrescriptionOrders({ size: 100 });
      } catch (err) {
        setStatus('error');
        setStatusMessage(getFriendlyErrorMessage(err, 'Could not load prescription orders'));
      }
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
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not load pharmacy data'));
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

// ============================================================================
// AdminLaboratoriesPage
// 
// Manages laboratory facilities and their operational details.
// Fetches and displays laboratories with ability to add, edit, and delete.
// ============================================================================
export function AdminLaboratoriesPage() {
  const urlQuery = useUrlQuery();
  const [laboratories, setLaboratories] = useState<Array<{ id: string; name: string; location: string; status: string; email?: string; phone?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [editingLab, setEditingLab] = useState<any | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    email: '',
    status: 'ACTIVE',
    operatingHoursStart: '',
    operatingHoursEnd: '',
    equipment: '',
    capacity: '',
    description: ''
  });

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredLaboratories = useMemo(() => {
    if (!query.trim()) return laboratories;
    const q = query.toLowerCase();
    return laboratories.filter((lab) => [lab.name, lab.location, lab.status].some((value) => value.toLowerCase().includes(q)));
  }, [laboratories, query]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await listLaboratories({ size: 30 });
      setLaboratories((data.content ?? []).map((lab: any) => ({
        id: lab.id,
        name: lab.name,
        location: lab.location,
        status: lab.status,
        email: lab.email,
        phone: lab.phone
      })));
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not load laboratories'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLaboratory({
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined
      });
      setStatus('success');
      setStatusMessage('Laboratory created successfully!');
      setShowForm(false);
      setFormData({
        name: '',
        location: '',
        phone: '',
        email: '',
        status: 'ACTIVE',
        operatingHoursStart: '',
        operatingHoursEnd: '',
        equipment: '',
        capacity: '',
        description: ''
      });
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not create laboratory'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this laboratory?')) return;
    try {
      await deleteLaboratory(id);
      setStatus('success');
      setStatusMessage('Laboratory deleted successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not delete laboratory'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Management"
        description="Manage laboratory facilities, equipment, and operational hours."
        actionLabel="Add Laboratory"
        onAction={() => setShowForm(true)}
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      {showForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Add Laboratory</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Laboratory Name</label>
                  <Input 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Central Lab"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Building A, Floor 2"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+251 123 456 789"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    type="email"
                    placeholder="lab@clinic.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Operating Hours Start</label>
                  <Input 
                    value={formData.operatingHoursStart}
                    onChange={e => setFormData({...formData, operatingHoursStart: e.target.value})}
                    placeholder="08:00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Operating Hours End</label>
                  <Input 
                    value={formData.operatingHoursEnd}
                    onChange={e => setFormData({...formData, operatingHoursEnd: e.target.value})}
                    placeholder="17:00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Capacity</label>
                  <Input 
                    value={formData.capacity}
                    onChange={e => setFormData({...formData, capacity: e.target.value})}
                    type="number"
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipment</label>
                <Input 
                  value={formData.equipment}
                  onChange={e => setFormData({...formData, equipment: e.target.value})}
                  placeholder="Analyzer, Centrifuge, Microscope"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Lab description"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Create Laboratory</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Laboratories</CardTitle>
            <CardDescription>Active facilities</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-teal-700">{laboratories.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>Operational</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{laboratories.filter(l => l.status === 'ACTIVE').length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
            <CardDescription>Under service</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-amber-600">{laboratories.filter(l => l.status === 'MAINTENANCE').length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Laboratories</CardTitle>
            <CardDescription>All laboratory facilities</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input className="max-w-xs" placeholder="Search laboratories..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={() => setShowForm(!showForm)}><Building2 className="h-4 w-4 mr-2" /> {showForm ? 'Cancel' : 'Add Lab'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : filteredLaboratories.length === 0 ? (
            <div className="text-sm text-muted-foreground">No laboratories found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLaboratories.map((lab) => (
                  <TableRow key={lab.id}>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>{lab.location}</TableCell>
                    <TableCell>{lab.phone || '-'}</TableCell>
                    <TableCell>{lab.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={lab.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {lab.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => (window.location.href = `/admin/laboratories/${lab.id}`)}>View</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(lab.id)}>Delete</Button>
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
// AdminLaboratoryDetailPage
//
// Displays a single laboratory dashboard for admins using live laboratory,
// doctor availability, and lab order data.
// ============================================================================
export function AdminLaboratoryDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [laboratory, setLaboratory] = useState<any | null>(null);
  const [availabilities, setAvailabilities] = useState<Array<any>>([]);
  const [orders, setOrders] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setStatus(null);
      const [labData, availabilityData, ordersData] = await Promise.all([
        getLaboratory(id),
        getDoctorAvailabilityByLaboratory(id),
        labOrdersService.list({ size: 12 })
      ]);
      setLaboratory(labData);
      setAvailabilities(availabilityData ?? []);
      setOrders(ordersData.content ?? []);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not load laboratory dashboard'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const activeSchedules = availabilities.filter((availability) => availability.isAvailable !== false);
  const pendingOrders = orders.filter((order) => String(order.status).toLowerCase() === 'pending');
  const criticalOrders = orders.filter((order) => String(order.urgency).toLowerCase() === 'critical');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72 rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!laboratory) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push(ROUTES.adminLaboratories)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Laboratories
        </Button>
        <StatusAlert status={status} message={statusMessage || 'Laboratory not found.'} onDismiss={() => setStatus(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" className="w-fit px-0" onClick={() => router.push(ROUTES.adminLaboratories)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Laboratories
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{laboratory.name}</h1>
            <p className="text-muted-foreground">Live laboratory dashboard for operations, orders, and doctor coverage.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>Refresh Data</Button>
          <Button onClick={() => router.push(ROUTES.adminDoctorAvailability)}>Manage Schedule</Button>
        </div>
      </div>

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Building2 className="h-5 w-5 text-teal-700" />
              {laboratory.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{laboratory.location}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Orders</CardDescription>
            <CardTitle className="text-3xl">{pendingOrders.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Awaiting laboratory processing</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical Queue</CardDescription>
            <CardTitle className="text-3xl text-red-600">{criticalOrders.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Orders marked critical</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Doctor Coverage</CardDescription>
            <CardTitle className="text-3xl">{activeSchedules.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Active availability entries</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Active Lab Queue</CardTitle>
              <CardDescription>Real orders from the laboratory order service</CardDescription>
            </div>
            <Badge variant="secondary">{orders.length} loaded</Badge>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No lab orders found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">{order.patientName || order.patientId}</div>
                        <div className="text-xs text-muted-foreground">{order.id}</div>
                      </TableCell>
                      <TableCell>{Array.isArray(order.tests) ? order.tests.join(', ') : 'Lab tests'}</TableCell>
                      <TableCell>{order.doctorName || order.doctorId}</TableCell>
                      <TableCell>
                        <Badge variant={String(order.urgency).toLowerCase() === 'critical' ? 'destructive' : 'outline'}>{order.urgency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={String(order.status).toLowerCase() === 'completed' ? 'success' : 'secondary'}>{order.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Laboratory Profile</CardTitle>
              <CardDescription>Facility details saved by the admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{laboratory.phone || '-'}</span>
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium break-all">{laboratory.email || '-'}</span>
                <span className="text-muted-foreground">Hours</span>
                <span className="font-medium">{laboratory.operatingHoursStart || '--'} - {laboratory.operatingHoursEnd || '--'}</span>
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">{laboratory.capacity ?? '-'}</span>
              </div>
              {laboratory.equipment && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="font-medium">Equipment</p>
                  <p className="mt-1 text-muted-foreground">{laboratory.equipment}</p>
                </div>
              )}
              {laboratory.description && <p className="text-muted-foreground">{laboratory.description}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Availability</CardTitle>
              <CardDescription>Schedule entries assigned to this lab</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {availabilities.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No doctor availability has been assigned.</div>
              ) : (
                availabilities.map((availability) => (
                  <div key={availability.id} className="rounded-2xl bg-muted/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{availability.doctorName}</p>
                        <p className="text-sm text-muted-foreground">{availability.dayOfWeek} - {availability.startTime} - {availability.endTime}</p>
                      </div>
                      <Badge variant={availability.isAvailable === false ? 'secondary' : 'success'}>
                        {availability.isAvailable === false ? 'Unavailable' : 'Available'}
                      </Badge>
                    </div>
                    {availability.maxPatients ? <p className="mt-2 text-xs text-muted-foreground">Capacity: {availability.maxPatients} patients</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AdminDoctorAvailabilityPage
// 
// Manages doctor availability schedules across laboratories.
// Allows admins to set working hours and availability for each doctor per lab.
// ============================================================================
export function AdminDoctorAvailabilityPage() {
  const urlQuery = useUrlQuery();
  const [availabilities, setAvailabilities] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    doctorId: '',
    laboratoryId: '',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    maxPatients: '10',
    notes: ''
  });

  const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredAvailabilities = useMemo(() => {
    if (!query.trim()) return availabilities;
    const q = query.toLowerCase();
    return availabilities.filter((av: any) => 
      [av.doctorName, av.laboratoryName, av.dayOfWeek].some((value) => value?.toLowerCase().includes(q))
    );
  }, [availabilities, query]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [docData, labData, avData] = await Promise.all([
        listDoctors({ size: 50 }),
        listLaboratories({ size: 50 }),
        listDoctorAvailability({ size: 100 })
      ]);
      setDoctors(docData.content || []);
      setLabs(labData.content || []);
      if ((labData.content || []).length === 1) {
        setFormData((current) => ({
          ...current,
          laboratoryId: labData.content[0].id,
        }));
      }
      setAvailabilities((avData.content || []).map((av: any) => ({
        id: av.id,
        doctorName: av.doctorName,
        doctorId: av.doctorId,
        laboratoryName: av.laboratoryName,
        laboratoryId: av.laboratoryId,
        dayOfWeek: av.dayOfWeek,
        startTime: av.startTime,
        endTime: av.endTime,
        isAvailable: av.isAvailable,
        maxPatients: av.maxPatients
      })));
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not load availability data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.laboratoryId) {
      setStatus('error');
      setStatusMessage('Please select a laboratory before saving availability.');
      return;
    }
    try {
      await createDoctorAvailability({
        doctorId: formData.doctorId,
        laboratoryId: formData.laboratoryId,
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isAvailable: formData.isAvailable,
        maxPatients: formData.maxPatients ? parseInt(formData.maxPatients, 10) : undefined,
        notes: formData.notes || undefined,
      });
      setStatus('success');
      setStatusMessage('Availability created successfully!');
      setShowForm(false);
      setFormData({
        doctorId: '',
        laboratoryId: '',
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
        maxPatients: '10',
        notes: ''
      });
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not create availability'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this availability?')) return;
    try {
      await deleteDoctorAvailability(id);
      setStatus('success');
      setStatusMessage('Availability deleted successfully!');
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not delete availability'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Availability Schedule"
        description="Configure doctor working hours and availability across laboratories."
        actionLabel="Add Availability"
        onAction={() => {
          setShowForm(true);
          if (labs.length === 1) {
            setFormData((current) => ({ ...current, laboratoryId: labs[0].id }));
          }
        }}
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      {showForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Add Doctor Availability</CardTitle>
            <CardDescription>
              Doctors without a custom schedule remain available by default. Add a schedule here to limit booking to specific days and times.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {labs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No laboratories found. Create a laboratory first, then return here to set doctor availability.
              </div>
            ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Doctor</label>
                  <select 
                    value={formData.doctorId}
                    onChange={e => setFormData({...formData, doctorId: e.target.value})}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3"
                    required
                  >
                    <option value="">Select a doctor</option>
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Laboratory</label>
                  <select 
                    value={formData.laboratoryId}
                    onChange={e => setFormData({...formData, laboratoryId: e.target.value})}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3"
                    required
                  >
                    <option value="">Select a laboratory</option>
                    {labs.map(lab => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Day of Week</label>
                  <select 
                    value={formData.dayOfWeek}
                    onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3"
                  >
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Patients</label>
                  <Input 
                    value={formData.maxPatients}
                    onChange={e => setFormData({...formData, maxPatients: e.target.value})}
                    type="number"
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input 
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    type="time"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Time</label>
                  <Input 
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    type="time"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Create Availability</Button>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Schedules</CardTitle>
            <CardDescription>Doctor availability records</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-blue-700">{availabilities.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Doctors</CardTitle>
            <CardDescription>Available by default unless a schedule is set</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{doctors.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laboratories Covered</CardTitle>
            <CardDescription>With doctor schedules</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-purple-600">{new Set(availabilities.map(a => a.laboratoryId)).size}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Doctor Schedules</CardTitle>
            <CardDescription>Availability across laboratories</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input className="max-w-xs" placeholder="Search schedules..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={() => {
              setShowForm(!showForm);
              if (!showForm && labs.length === 1) {
                setFormData((current) => ({ ...current, laboratoryId: labs[0].id }));
              }
            }}><Clock className="h-4 w-4 mr-2" /> {showForm ? 'Cancel' : 'Add Schedule'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : filteredAvailabilities.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No custom schedules yet. All doctors are currently available by default for appointment booking.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Laboratory</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAvailabilities.map((av: any) => (
                  <TableRow key={av.id}>
                    <TableCell className="font-medium">{av.doctorName}</TableCell>
                    <TableCell>{av.laboratoryName}</TableCell>
                    <TableCell><Badge variant="outline">{av.dayOfWeek}</Badge></TableCell>
                    <TableCell>{av.startTime} - {av.endTime}</TableCell>
                    <TableCell>{av.maxPatients || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(av.id)}>Delete</Button>
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
