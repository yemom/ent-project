'use client';
import { Sparkles, Filter } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { ROUTES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OverviewChart } from '@/components/charts/overview-chart';
import { PageHeader } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createDoctor,
  createPatient,
  deletePatient,
  inviteUser,
  updatePatient,
} from "@/services/api/admin";
import { listUsers, listDoctors, listPatients } from '@/services/api/users';
import { listAppointments } from '@/services/api/appointments';
import { useRouter } from 'next/navigation';

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
        console.error("Failed to fetch dashboard stats", err);
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
  const [users, setUsers] = useState<Array<{ name: string; role: string; status: string; lastLogin: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter((user) => [user.name, user.role, user.status].some((value) => value.toLowerCase().includes(q)));
  }, [query, users]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listUsers({ size: 30 });
        setUsers((data.content ?? []).map((u) => ({
          name: u.fullName,
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
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.name}>
                    <TableCell className="font-medium">{user.name}</TableCell>
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
  const [doctors, setDoctors] = useState<Array<{ name: string; role: string; status: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listDoctors({ size: 30 });
        setDoctors((data.content ?? []).map((d) => ({
          name: d.fullName,
          role: d.role,
          status: d.status
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
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </>
            ) : doctors.length === 0 ? (
              <div className="text-sm text-muted-foreground">No doctors found.</div>
            ) : (
              doctors.map((doc) => (
                <div key={doc.name} className="rounded-2xl bg-muted/50 p-4">
                  <p className="font-semibold">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">{doc.role}</p>
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
  const [patients, setPatients] = useState<Array<{ id: string; name: string; email: string; status: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPatient, setEditingPatient] = useState<{ id: string; name: string; email: string } | null>(null);

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
      fetchData();
    } catch (err) {
      alert('Failed to delete patient');
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
      fetchData();
    } catch (err) {
      alert('Failed to update patient');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Patient Management" description="Review patient engagement, care plans, and follow-up status." actionLabel="Import Patients" actionHref={ROUTES.adminImportPatients} />
      
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
          <CardTitle>Patient List</CardTitle>
          <CardDescription>Detailed directory of all registered patients</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-12 w-full rounded" />
            </div>
          ) : patients.length === 0 ? (
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
                {patients.map((patient, idx) => (
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
  const [appointments, setAppointments] = useState<Array<{ time: string; patient: string; status: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listAppointments({ size: 30 });
        setAppointments((data.content ?? []).map((a) => ({
          time: new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          patient: a.patientName,
          status: a.status
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
          <CardTitle>Today's queue</CardTitle>
          <CardDescription>Appointment states and room usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : appointments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No appointments scheduled.</div>
          ) : (
            appointments.map((apt, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <span className="font-medium">{apt.time} - {apt.patient}</span>
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
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Adjust organization, notifications, and security preferences." />
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Email, SMS, and operational alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Email summary reports</span>
            <Badge variant="success">On</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Appointment reminders</span>
            <Badge variant="success">On</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Security alerts</span>
            <Badge variant="success">On</Badge>
          </div>
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
