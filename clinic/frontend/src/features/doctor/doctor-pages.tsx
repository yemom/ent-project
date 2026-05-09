"use client";
import {
  Calendar,
  ClipboardList,
  Clock3,
  Filter,
  PillBottle,
  Search,
  Users,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/services/api/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layouts/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useAppointments } from "@/hooks/useAppointments";
import { createAppointment } from "@/services/api/appointments";
import { Skeleton } from "@/components/ui/skeleton";
import { listMedicalRecords, searchMedicalRecords, createMedicalRecord } from "@/services/api/medical-records";
import { listPrescriptions } from "@/services/api/prescriptions";
import { listPatients } from "@/services/api/users";
import { useAuthStore } from "@/store/auth-store";

// ============================================================================
// DoctorDashboardPage
// 
// This component serves as the main landing page for doctors. It provides
// a high-level overview of their day, including stats and a list of upcoming
// appointments. It uses the `useAppointments` hook to fetch data.
// ============================================================================
export function DoctorDashboardPage() {
  const { appointments, isLoading, error } = useAppointments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Dashboard"
        description="Track today's schedule, clinical work, and patient follow-up."
        actionLabel="New Record"
        actionHref="/doctor/records/new"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <CardDescription>
              {isLoading ? "..." : `${appointments.length} scheduled visits`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinical Efficiency</CardTitle>
            <CardDescription>Average visit duration: 18 min</CardDescription>
          </CardHeader>
          <CardContent>
            <Clock3 className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Volume</CardTitle>
            <CardDescription>85% capacity utilized</CardDescription>
          </CardHeader>
          <CardContent>
            <Users className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
          <CardDescription>High-priority patient review queue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!isLoading &&
            !error &&
            appointments.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{item.patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">{item.time}</p>
                </div>
                <Badge
                  variant={
                    item.status === "CONFIRMED"
                      ? "success"
                      : item.status === "IN_PROGRESS"
                        ? "default"
                        : item.status === "PENDING"
                          ? "warning"
                          : "destructive"
                  }
                >
                  {item.status}
                </Badge>
              </div>
            ))}

          {!isLoading && !error && appointments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No appointments scheduled for today.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorAppointmentsPage
// ============================================================================
export function DoctorAppointmentsPage() {
  const { appointments, isLoading, error } = useAppointments();
  const [query, setQuery] = useState('');

  const filteredAppointments = useMemo(() => {
    if (!query.trim()) return appointments;
    const q = query.toLowerCase();
    return appointments.filter((item) =>
      [item.patient.fullName, item.time, item.status, item.type].some((value) => value.toLowerCase().includes(q))
    );
  }, [appointments, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Appointments"
        description="Manage incoming visits with clear status and conflict prevention."
        actionLabel="New Appointment"
        actionHref="/doctor/appointments/new"
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>Real appointments and the next items in the queue</CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-white p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Clock3 className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="rounded-full">
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Clock3 className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search appointments, patients, or status..."
              />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!isLoading && !error && filteredAppointments.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No appointments match your search.
              </p>
            )}

            {!isLoading && !error && filteredAppointments.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.patient.fullName}</TableCell>
                      <TableCell>{item.time}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "CONFIRMED"
                              ? "success"
                              : item.status === "IN_PROGRESS"
                                ? "default"
                                : item.status === "PENDING"
                                  ? "warning"
                                  : "destructive"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.location.href = `/doctor/records/new?appointmentId=${item.id}`;
                          }}
                        >
                          Open Record
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Fast access to the most common tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button className="justify-start rounded-2xl" variant="secondary" onClick={() => { window.location.href = '/doctor/appointments/new'; }}>
                Create new appointment
              </Button>
              <Button className="justify-start rounded-2xl" variant="secondary" onClick={() => { window.location.href = '/doctor/records/new'; }}>
                Write medical record
              </Button>
              <Button className="justify-start rounded-2xl" variant="secondary" onClick={() => { window.location.href = '/doctor/patients'; }}>
                Open patient directory
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <span>Total appointments</span>
                <Badge variant="outline">{appointments.length}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <span>Filtered view</span>
                <Badge variant="outline">{filteredAppointments.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DoctorCreateAppointmentPage
// ============================================================================
export function DoctorCreateAppointmentPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        const [patientsData, doctorsData] = await Promise.all([
          listPatients({ size: 100 }),
          user?.role === 'ADMIN'
            ? apiClient.get('/doctors?size=100')
            : Promise.resolve({ data: { content: [] } })
        ]);
        setPatients(patientsData.content ?? []);
        if (user?.role === 'ADMIN') {
          setDoctors((doctorsData as any).data.content ?? []);
        }
      } catch (err) {
        console.error("Failed to load data", err);
      }
    }
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId = user?.role === 'DOCTOR' ? user.id : selectedDoctorId;
    if (!selectedPatientId || !docId) {
      alert("Please select both patient and doctor.");
      return;
    }

    try {
      setIsSubmitting(true);
      const appointmentDate = `${date}T${time}:00`;
      await createAppointment({
        patientId: selectedPatientId,
        doctorId: docId,
        appointmentDate,
        duration: parseInt(duration, 10) || 30,
        status: 'SCHEDULED',
        reasonForVisit: reason,
        notes
      });
      window.location.href = '/doctor/appointments';
    } catch (err) {
      console.error("Failed to create appointment", err);
      alert("Failed to schedule appointment. The selected doctor may not be available or there is a server error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule New Appointment"
        description="Book a new clinical session with a registered patient."
        actionLabel="Cancel"
        actionHref="/doctor/appointments"
      />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Patient</label>
              <select
                className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Visit</label>
              <Input
                placeholder="Brief reason (e.g., Routine Checkup)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="h-11 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Clinical Notes</label>
              <textarea
                placeholder="Internal notes for this appointment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[100px] rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="rounded-full px-8" disabled={isSubmitting}>
                {isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => window.history.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorPatientsPage
// ============================================================================
export function DoctorPatientsPage() {
  const [patients, setPatients] = useState<
    Array<{ id: string; fullName: string; email: string; role: string; lastLogin?: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listPatients({ size: 30 });
        setPatients((data.content ?? []).map((p) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          role: p.role,
          lastLogin: p.lastLogin
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Directory"
        description="View and manage patient records and histories."
        actionLabel="Add Patient"
      />
      <Card>
        <CardHeader>
          <CardTitle>Patient List</CardTitle>
          <CardDescription>Recently registered or active patients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : patients.length === 0 ? (
            <div className="text-sm text-muted-foreground">No patients found.</div>
          ) : (
            patients.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-semibold">{patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">{patient.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/doctor/patients/${patient.id}`;
                  }}
                >
                  View Details
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorPatientDetailPage
// ============================================================================
export function DoctorPatientDetailPage({ id }: { id: string }) {
  const [patient, setPatient] = useState<
    { id: string; fullName: string; email: string; role: string; lastLogin?: string } | null
  >(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Fetch patient list to find this specific one (backend doesn't have direct getById for all users easily yet)
        const patientData = await listPatients({ size: 100 });
        const found = (patientData.content ?? []).find(p => p.id === id);
        if (found) {
          setPatient({
            id: found.id,
            fullName: found.fullName,
            email: found.email,
            role: found.role,
            lastLogin: found.lastLogin
          });
        }

        // Fetch this patient's medical records
        const recordsData = await searchMedicalRecords({ patientId: id });
        setRecords(recordsData.content ?? []);
      } catch (err) {
        console.error("Error fetching patient details", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Details"
        description="Detailed patient information and medical history."
        actionLabel="Back to Directory"
        actionHref={user?.role === 'ADMIN' ? '/admin/patients' : '/doctor/patients'}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient Profile</CardTitle>
            <CardDescription>Demographics and active status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-8 w-1/4" />
              </div>
            ) : !patient ? (
              <div className="text-sm text-muted-foreground">Patient not found.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Full Name</p>
                  <p className="text-lg font-medium">{patient.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Email</p>
                  <p className="text-lg">{patient.email}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">System Role</p>
                  <Badge variant="outline">{patient.role}</Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Last Login</p>
                  <p className="text-lg">
                    {patient.lastLogin
                      ? new Date(patient.lastLogin).toLocaleString()
                      : 'Never logged in'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medical History</CardTitle>
            <CardDescription>Recent records and treatments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-sm text-muted-foreground">No clinical records found.</div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="border-b pb-4 last:border-0">
                    <p className="font-semibold text-teal-700">
                      {new Date(record.recordDate || record.visitDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-medium mt-1">Diagnosis: {record.diagnosis}</p>
                    {record.treatment && <p className="text-sm text-muted-foreground">Treatment: {record.treatment}</p>}
                    {record.prescription && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-xs font-bold text-amber-800 uppercase">Prescription</p>
                        <p className="text-sm text-amber-900">{record.prescription}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// DoctorRecordsPage
// ============================================================================
export function DoctorRecordsPage() {
  const [records, setRecords] = useState<
    Array<{ id: string; diagnosis: string; status: string; visitDate: string; patientName: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listMedicalRecords({ size: 30 });
        setRecords((data.content ?? []).map((r) => ({
          id: r.id,
          diagnosis: r.diagnosis,
          status: (r.status || r.medicalRecordType || 'SIGNED') as string,
          visitDate: (r.recordDate || r.visitDate || new Date().toISOString()) as string,
          patientName: r.patient?.fullName || r.patientName
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="Draft and sign clinical notes with structured encounter fields."
        actionLabel="New Record"
        actionHref="/doctor/records/new"
      />
      <Card>
        <CardHeader>
          <CardTitle>Patient Records</CardTitle>
          <CardDescription>Recent medical encounters and summaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : records.length === 0 ? (
            <div className="text-sm text-muted-foreground">No records found.</div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-semibold">{record.patientName}</p>
                  <p className="text-sm text-muted-foreground">{record.diagnosis}</p>
                  <p className="text-xs text-muted-foreground">{new Date(record.visitDate).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline">{record.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorCreateRecordPage
// ============================================================================
export function DoctorCreateRecordPage() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId') ?? undefined;
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescription, setPrescription] = useState('');
  const [notes, setNotes] = useState('');
  const [medicalRecordType, setMedicalRecordType] = useState('CONSULTATION');
  const [confidential, setConfidential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        const [patientsData, doctorsData] = await Promise.all([
          listPatients({ size: 100 }),
          user?.role === 'ADMIN'
            ? apiClient.get('/doctors?size=100')
            : Promise.resolve({ data: { content: [] } })
        ]);
        setPatients(patientsData.content ?? []);
        if (user?.role === 'ADMIN') {
          setDoctors((doctorsData as any).data.content ?? []);
        }
      } catch (err) {
        console.error("Failed to load patients", err);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId = user?.role === 'DOCTOR' ? user.id : selectedDoctorId;
    if (!selectedPatientId || !user || !docId) {
      alert('Please select both patient and doctor.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createMedicalRecord({
        patientId: selectedPatientId,
        doctorId: docId,
        appointmentId,
        diagnosis,
        treatment,
        prescription,
        notes,
        recordDate: new Date().toISOString().split('T')[0],
        medicalRecordType,
        confidential,
        followUpRequired: false
      });
      window.location.href = `/doctor/patients/${selectedPatientId}`;
    } catch (err) {
      console.error("Failed to create medical record", err);
      alert("Failed to create record. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Medical Record"
        description="Enter clinical encounter details, diagnosis, and care plan."
        actionLabel="Cancel"
        actionHref="/doctor/records"
      />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Patient</label>
                <select
                  className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
              </div>
                {user?.role === 'ADMIN' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Doctor</label>
                    <select 
                      className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Record Type</label>
                <select
                  className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                  value={medicalRecordType}
                  onChange={(e) => setMedicalRecordType(e.target.value)}
                >
                  <option value="CONSULTATION">Consultation</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="PRESCRIPTION">Prescription</option>
                  <option value="NOTES">Notes</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Confidential Record</label>
                <select
                  className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                  value={confidential ? 'true' : 'false'}
                  onChange={(e) => setConfidential(e.target.value === 'true')}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Diagnosis</label>
              <Input
                placeholder="Primary diagnosis or impression"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
                className="h-11 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Treatment Plan</label>
              <textarea
                placeholder="Recommended procedures or actions"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                className="w-full min-h-[100px] rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prescription</label>
              <textarea
                placeholder="Drugs, dosage, and frequency"
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                className="w-full min-h-[80px] rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Clinical Notes</label>
              <textarea
                placeholder="Observations and additional findings"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[80px] rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="rounded-full px-8" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Clinical Record'}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => window.history.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorPrescriptionsPage
// ============================================================================
export function DoctorPrescriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Prescription"
        description="Issue secure prescriptions with validation and interaction checks."
        actionLabel="Check Interactions"
      />
      <Card>
        <CardHeader>
          <CardTitle>Medication order</CardTitle>
          <CardDescription>Prescription workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <span>Lisinopril 10mg</span>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <span>Metformin 500mg</span>
            <Badge variant="warning">Pending</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorAvailabilityPage
// ============================================================================
export function DoctorAvailabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Schedule"
        description="Set office hours, slot buffers, and telehealth availability."
      />
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2 p-6">
          <div className="rounded-2xl bg-primary/10 p-4">
            Mon-Fri 09:00 - 17:00
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            Telehealth: Wednesdays 18:00 - 20:00
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorSchedulePage
// ============================================================================
export function DoctorSchedulePage() {
  const { appointments, isLoading } = useAppointments();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    async function fetchPatients() {
      try {
        const data = await listPatients({ size: 100 });
        setPatients(data.content ?? []);
      } catch (err) {
        console.error("Failed to load patients", err);
      }
    }
    fetchPatients();
  }, []);

  const handleCreateSlot = async () => {
    if (!selectedPatientId || !user) return;
    try {
      setIsSubmitting(true);
      // Ensure seconds are included for the backend pattern
      const appointmentDate = `${date}T${time}:00`;
      await createAppointment({
        patientId: selectedPatientId,
        doctorId: user.id,
        appointmentDate,
        duration: 30,
        status: 'SCHEDULED',
        reasonForVisit: 'Quick Add Appointment'
      });
      window.location.reload(); // Refresh to see new appointment
    } catch (err) {
      console.error("Failed to create appointment", err);
      alert("Failed to create appointment. Please check details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Schedule"
        description="Coordinate visits, quick add slots, and review the day's appointment queue."
        actionLabel="New Appointment"
        actionHref="/doctor/appointments/new"
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>
                  Scheduled appointments and operative hours
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-white p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Clock3 className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="rounded-full">
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Clock3 className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No appointments scheduled for today.
              </p>
            ) : (
              <div className="space-y-3">
                {appointments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border-l-4 border-teal-500 bg-white p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
                      {item.type}
                    </p>
                    <p className="mt-2 text-sm font-medium">{item.patient.fullName}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                    <Badge className="mt-2" variant={item.status === 'CONFIRMED' ? 'success' : 'warning'}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Add</CardTitle>
              <CardDescription>Schedule a new visit fast.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-2xl"
                />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
              <Button
                className="w-full rounded-2xl"
                onClick={handleCreateSlot}
                disabled={isSubmitting || !selectedPatientId}
              >
                {isSubmitting ? 'Creating...' : 'Create Slot'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>View Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Department</span>
                <Badge variant="outline">All</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Room</span>
                <Badge variant="outline">All Rooms</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function DoctorCalendarPage() {
  return <DoctorSchedulePage />;
}

// ============================================================================
// DoctorPrescriptionManagementPage
// ============================================================================
export function DoctorPrescriptionManagementPage() {
  const authUser = useAuthStore((state) => state.user);
  const [prescriptions, setPrescriptions] = useState<
    Array<{ id: string; drugName: string; status: string; prescribedAt: string; patientName: string; dosage: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newPrescriptionForm, setNewPrescriptionForm] = useState({
    patientName: '',
    drugName: '',
    dosage: '',
    frequency: 'Once daily',
    duration: '14',
    instructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listPrescriptions({ size: 30 });
        setPrescriptions((data.content ?? []).map((p) => ({
          id: p.id,
          drugName: p.drugName,
          dosage: p.dosage,
          status: p.status,
          prescribedAt: p.prescribedAt,
          patientName: p.patientName
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredPrescriptions = useMemo(() => {
    if (!query.trim()) return prescriptions;
    const q = query.toLowerCase();
    return prescriptions.filter((item) => [item.drugName, item.patientName, item.status, item.dosage].some((value) => value.toLowerCase().includes(q)));
  }, [query, prescriptions]);

  const handleSendToPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrescriptionForm.patientName || !newPrescriptionForm.drugName || !authUser?.id) {
      alert('Please fill in required fields');
      return;
    }
    
    try {
      setIsSubmitting(true);
      await apiClient.post('/prescription-orders', {
        doctorId: authUser.id,
        doctorName: authUser.fullName,
        patientName: newPrescriptionForm.patientName,
        drugName: newPrescriptionForm.drugName,
        dosage: newPrescriptionForm.dosage,
        instructions: newPrescriptionForm.instructions
      });
      setNewPrescriptionForm({
        patientName: '',
        drugName: '',
        dosage: '',
        frequency: 'Once daily',
        duration: '14',
        instructions: ''
      });
      alert('Prescription sent to pharmacy successfully!');
      // Refetch prescriptions
      const data = await listPrescriptions({ size: 30 });
      setPrescriptions((data.content ?? []).map((p) => ({
        id: p.id,
        drugName: p.drugName,
        dosage: p.dosage,
        status: p.status,
        prescribedAt: p.prescribedAt,
        patientName: p.patientName
      })));
    } catch (err) {
      console.error('Failed to send prescription', err);
      alert('Failed to send prescription to pharmacy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription Management"
        description="Precision pharmacology and patient safety center"
        actionLabel="Bulk Export"
      />
      
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Left Column: New Prescription Form & Active Prescriptions */}
        <div className="space-y-6">
          {/* New Prescription Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PillBottle className="h-5 w-5" />
                New Prescription
              </CardTitle>
              <CardDescription>Authorize and send medications to pharmacy for dispensing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendToPharmacy} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900">Patient Name</label>
                  <Input
                    className="mt-2 h-11 rounded-2xl"
                    placeholder="Eleanor Shellstrop"
                    value={newPrescriptionForm.patientName}
                    onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, patientName: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-900">Drug Search (Auto-complete)</label>
                    <div className="mt-2 relative">
                      <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        className="pl-10 h-11 rounded-2xl"
                        placeholder="Start typing medication name..."
                        value={newPrescriptionForm.drugName}
                        onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, drugName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900">Dosage</label>
                    <select className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm">
                      <option>5mg</option>
                      <option>10mg</option>
                      <option>25mg</option>
                      <option>50mg</option>
                      <option>100mg</option>
                      <option>500mg</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-900">Frequency</label>
                    <select 
                      className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                      value={newPrescriptionForm.frequency}
                      onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, frequency: e.target.value })}
                    >
                      <option>Once daily (QD)</option>
                      <option>Twice daily (BD)</option>
                      <option>Thrice daily (TDS)</option>
                      <option>Four times daily (QID)</option>
                      <option>As needed (PRN)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900">Duration (Days)</label>
                    <Input
                      className="mt-2 h-11 rounded-2xl"
                      type="number"
                      value={newPrescriptionForm.duration}
                      onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, duration: e.target.value })}
                      placeholder="14"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900">Pharmacist Instructions</label>
                  <textarea
                    className="mt-2 min-h-[100px] rounded-2xl border border-border bg-white px-3 py-2 text-sm"
                    placeholder="Additional administration notes, contraindications, or specific instructions for the pharmacy..."
                    value={newPrescriptionForm.instructions}
                    onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, instructions: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900">Digital Signature Authentication</label>
                  <div className="mt-2 h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                    <div className="text-center">
                      <PillBottle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to sign or use biometric authentication</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">✓ Encrypted signature will be timestamped and logged via secure gateway</p>
                </div>

                <Button 
                  type="submit"
                  className="w-full rounded-2xl bg-teal-700 hover:bg-teal-800 text-white h-11"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Authorize & Send to Pharmacy'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Prescriptions Table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 gap-4">
              <div>
                <CardTitle>Active Prescriptions</CardTitle>
                <CardDescription>Current medications for your patients</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 rounded-2xl border border-border bg-background p-3 mb-4 shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  placeholder="Search medications or patients..."
                />
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Dosage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-10 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPrescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No prescriptions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrescriptions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.drugName}</TableCell>
                          <TableCell>{item.patientName}</TableCell>
                          <TableCell>{item.dosage}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === 'ACTIVE'
                                  ? 'success'
                                  : item.status === 'PENDING'
                                    ? 'warning'
                                    : 'outline'
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg">
                              <Search className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar Info Cards */}
        <div className="space-y-4">
          {/* Drug Interaction Check */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-teal-700" />
                Drug Interaction Check
              </CardTitle>
              <CardDescription>Safety verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-teal-200 bg-white p-4">
                <p className="text-sm text-teal-900">
                  <span className="font-semibold">✓ No contraindications</span> detected for Lisinopril and current patient history.
                </p>
                <p className="text-xs text-teal-700 mt-2">Safety protocol 4.0 verified.</p>
              </div>
            </CardContent>
          </Card>

          {/* Prescription History */}
          <Card>
            <CardHeader>
              <CardTitle>Prescription History</CardTitle>
              <CardDescription>Recent prescriptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">24 OCT, 2023</p>
                <p className="text-muted-foreground">Amoxicillin • 500mg • Completed course</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">12 AUG, 2023</p>
                <p className="text-muted-foreground">Ibuprofen • 800mg • Expired</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">05 JUN, 2023</p>
                <p className="text-muted-foreground">Atorvastatin • 20mg • Discontinued</p>
              </div>
              <Button variant="ghost" className="w-full text-teal-700 hover:text-teal-800">
                View full history
              </Button>
            </CardContent>
          </Card>

          {/* Patient Adherence Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Adherence Rate</CardTitle>
              <CardDescription>Last 7 days via patient app</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-4xl font-bold text-teal-700">94.2%</div>
                  <p className="text-xs text-muted-foreground mt-1">Medication taken as prescribed</p>
                </div>
                
                {/* Adherence Chart */}
                <div className="flex items-end justify-between gap-1 h-16">
                  {[65, 75, 85, 92, 88, 95, 94].map((value, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-teal-200 rounded-t-lg transition-all"
                        style={{ height: `${(value / 100) * 60}px` }}
                      />
                      <div className={`w-full h-3 rounded-full ${value >= 90 ? 'bg-teal-600' : value >= 80 ? 'bg-teal-500' : 'bg-teal-300'}`} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">Mon Tue Wed Thu Fri Sat Sun</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DoctorOrderDrugPage
//
// Allows doctors to send prescription orders directly to the pharmacy.
// ============================================================================
export function DoctorOrderDrugPage() {
  const authUser = useAuthStore((state) => state.user);
  const [patientName, setPatientName] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !drugName || !dosage || !authUser?.id) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post("/prescription-orders", {
        doctorId: authUser.id,
        doctorName: authUser.fullName,
        patientName,
        drugName,
        dosage,
        instructions,
      });
      setSuccessMessage("Drug order sent to pharmacy successfully!");
      setPatientName("");
      setDrugName("");
      setDosage("");
      setInstructions("");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Failed to send drug order", err);
      alert("Failed to send drug order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Drug to Pharmacy"
        description="Send prescription orders directly to the pharmacy for fulfillment."
      />

      <Card>
        <CardHeader>
          <CardTitle>New Drug Order</CardTitle>
          <CardDescription>
            Fill in the details of the drug order you want to send to the pharmacy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
              {successMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Patient Name *</label>
              <Input
                type="text"
                placeholder="Enter patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Drug Name *</label>
              <Input
                type="text"
                placeholder="Enter drug name (e.g., Amoxicillin)"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Dosage *</label>
              <Input
                type="text"
                placeholder="Enter dosage (e.g., 500mg)"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions</label>
              <textarea
                placeholder="Enter any special instructions for the pharmacist..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[100px] w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl"
            >
              {isSubmitting ? "Sending..." : "Send Order to Pharmacy"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
