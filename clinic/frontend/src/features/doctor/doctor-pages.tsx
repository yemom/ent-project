/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import {
  Beaker,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  Pencil,
  PillBottle,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { LabOrderForm } from '@/features/laboratory/components/lab-order-form';
import { createAppointment } from "@/services/api/appointments";
import { Skeleton } from "@/components/ui/skeleton";
import { getMedicalRecord, listMedicalRecords, searchMedicalRecords, createMedicalRecord, updateMedicalRecord, deleteMedicalRecord } from "@/services/api/medical-records";
import { getPatient, listPatients, updatePatient } from "@/services/api/users";
import { useLabOrders } from '@/features/laboratory/hooks/use-lab-orders';
import { LabOrderList } from '@/features/laboratory/components/lab-order-list';
import {
  listPrescriptionOrdersByDoctor,
  listPrescriptionOrders,
  updatePrescriptionOrder,
  deletePrescriptionOrder
} from "@/features/prescriptions";
import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/store/auth-store";
import { StatusAlert, type StatusType } from "@/components/shared/status-alert";
import { getFriendlyErrorMessage } from "@/lib/error-handler";
import { labOrdersService } from "@/features/laboratory/services/lab-orders.service";
import { labResultsService } from "@/features/laboratory/services/lab-results.service";
import { LAB_TEST_TYPES, LAB_URGENCY } from "@/lib/constants";

// ============================================================================
// DoctorDashboardPage
// 
// This component serves as the main landing page for doctors. It provides
// a high-level overview of their day, including stats and a list of upcoming
// appointments. It uses the `useAppointments` hook to fetch data.
// ============================================================================
export function DoctorDashboardPage() {
  const router = useRouter();
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
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{item.patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">{item.time}</p>
                </div>
                <div className="flex items-center gap-2">
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
                  {item.patient.id && item.patient.id.length > 8 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/doctor/patients/${item.patient.id}`)}
                    >
                      View
                    </Button>
                  )}
                </div>
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

function PatientLabOrders({ patientId }: { patientId: string }) {
  const { orders } = useLabOrders({ patientId });
  return <LabOrderList orders={orders} />;
}

// ============================================================================
// DoctorAppointmentsPage
// ============================================================================
export function DoctorAppointmentsPage() {
  const router = useRouter();
  const { appointments, isLoading, error } = useAppointments();
  const urlQuery = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredAppointments = useMemo(() => {
    if (!query.trim()) return appointments;
    const q = query.toLowerCase();
    return appointments.filter((item) =>
      [item.patient.fullName, item.time, item.status, item.type].some((value) => value.toLowerCase().includes(q))
    );
  }, [appointments, query]);

  const [labModal, setLabModal] = useState<{ open: boolean; appointmentId?: string; patientId?: string; doctorId?: string } | null>(null);

  useEffect(() => {
    const handler = () => {
      const data = (window as any).__labOrderModal;
      if (data && data.open) {
        setLabModal({ open: true, appointmentId: data.appointmentId, patientId: data.patientId, doctorId: data.doctorId });
      }
    };
    window.addEventListener('labOrderOpen', handler);
    return () => window.removeEventListener('labOrderOpen', handler);
  }, []);

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
                        <div className="flex items-center gap-2 justify-end">
                          {item.patient?.id && item.patient.id.length > 8 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/doctor/patients/${item.patient.id}`)}
                            >
                              View
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.location.href = `/doctor/records/new?appointmentId=${item.id}`;
                            }}
                          >
                            Open Record
                          </Button>
                          <Button size="sm" onClick={() => {
                            // open inline modal
                            (window as any).__labOrderModal = { open: true, appointmentId: item.id, patientId: item.patient.id, doctorId: item.doctor.id };
                            window.dispatchEvent(new Event('labOrderOpen'));
                          }}>
                            Send to Lab
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {labModal?.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-2xl rounded bg-white p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Create Lab Order</h3>
                    <button onClick={() => setLabModal(null)} className="text-sm text-muted-foreground">Close</button>
                  </div>
                  <LabOrderForm
                    patientId={labModal.patientId ?? ''}
                    doctorId={labModal.doctorId ?? ''}
                    appointmentId={labModal.appointmentId}
                    onSuccess={() => { setLabModal(null); window.location.reload(); }}
                  />
                </div>
              </div>
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
  const router = useRouter();
  const urlQuery = useSearchParams().get('q') ?? '';
  const [patients, setPatients] = useState<
    Array<{ id: string; fullName: string; email: string; role: string; lastLogin?: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredPatients = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.toLowerCase();
    return patients.filter((patient) => [patient.fullName, patient.email, patient.role].some((value) => value.toLowerCase().includes(q)));
  }, [patients, query]);

  useEffect(() => {
    if (!isHydrated || !accessToken) return;

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
  }, [isHydrated, accessToken]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Directory"
        description="View and manage patient records and histories."
        actionLabel="Add Patient"
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Patient List</CardTitle>
              <CardDescription>Recently registered or active patients</CardDescription>
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
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : filteredPatients.length === 0 ? (
            <div className="text-sm text-muted-foreground">No patients found.</div>
          ) : (
            filteredPatients.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-semibold">{patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">{patient.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/doctor/patients/${patient.id}`)}
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
  const router = useRouter();
  const [patient, setPatient] = useState<
    {
      id: string;
      fullName: string;
      email: string;
      role: string;
      lastLogin?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: string;
      medicalHistory?: string;
      bloodType?: string;
      allergies?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      active?: boolean;
    } | null
  >(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authReady = isHydrated && Boolean(accessToken);
  const pageLoading = !authReady || isLoading;
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ diagnosis: '', treatment: '', prescription: '', notes: '' });
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    bloodType: '',
    allergies: '',
    medicalHistory: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  const startEditingProfile = () => {
    if (!patient) return;
    setProfileForm({
      bloodType: patient.bloodType || '',
      allergies: patient.allergies || '',
      medicalHistory: patient.medicalHistory || '',
      phone: patient.phone || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || ''
    });
    setIsEditingProfile(true);
    setStatus(null);
  };

  const handleSaveProfile = async () => {
    try {
      const updated = await updatePatient(id, profileForm);
      if (patient) setPatient({ ...patient, ...updated });
      setIsEditingProfile(false);
      setStatus('success');
      setStatusMessage('Patient profile updated successfully!');
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Failed to update patient profile'));
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (!accessToken || !id) {
      setIsLoading(false);
      setPatient(null);
      setRecords([]);
      setFetchError('Please sign in again to view patient details.');
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        setFetchError('');

        const [found, recordsData] = await Promise.all([
          getPatient(id),
          searchMedicalRecords({ patientId: id, size: 50 }).catch(() => ({ content: [] }))
        ]);

        if (cancelled) return;

        setPatient({
          id: found.id,
          fullName: found.fullName,
          email: found.email,
          role: found.role,
          lastLogin: found.lastLogin,
          phone: found.phone,
          dateOfBirth: found.dateOfBirth,
          gender: found.gender,
          medicalHistory: found.medicalHistory,
          bloodType: found.bloodType,
          allergies: found.allergies,
          emergencyContactName: found.emergencyContactName,
          emergencyContactPhone: found.emergencyContactPhone,
          active: found.active
        });
        setRecords(recordsData.content ?? []);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching patient details', err);
        setPatient(null);
        setRecords([]);
        setFetchError(getFriendlyErrorMessage(err, 'Could not load patient details. Please try again.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id, isHydrated, accessToken]);

  const startEditing = (record: any) => {
    setEditingRecordId(record.id);
    setEditForm({
      diagnosis: record.diagnosis || '',
      treatment: record.treatment || '',
      prescription: record.prescription || '',
      notes: record.notes || ''
    });
    setStatus(null);
  };

  const handleSaveEdit = async () => {
    if (!editingRecordId) return;
    try {
      await updateMedicalRecord(editingRecordId, editForm);
      setRecords(records.map(r =>
        r.id === editingRecordId ? { ...r, ...editForm } : r
      ));
      setEditingRecordId(null);
      setStatus('success');
      setStatusMessage('Medical record updated successfully!');
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Failed to update medical record'));
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Delete this medical record? This action cannot be undone.')) return;
    try {
      await deleteMedicalRecord(recordId);
      setRecords(records.filter(r => r.id !== recordId));
      setStatus('success');
      setStatusMessage('Medical record deleted successfully!');
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Failed to delete medical record'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Details"
        description="Detailed patient information and medical history."
        actionLabel="Back to Directory"
        actionHref={user?.role === 'ADMIN' ? '/admin/patients' : '/doctor/patients'}
      />
      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />
      {fetchError ? (
        <StatusAlert
          status="error"
          message={fetchError}
          onDismiss={() => setFetchError('')}
        />
      ) : null}

      {pageLoading && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {!pageLoading && patient && (
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-white via-white to-teal-50 shadow-sm">
          <CardContent className="p-6">
            <div className="grid gap-6 lg:grid-cols-[150px_1fr_auto]">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-teal-100 text-4xl font-bold text-teal-800">
                {patient.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-4xl font-bold text-slate-950">{patient.fullName}</h2>
                  <Badge variant={patient.active === false ? 'secondary' : 'success'}>{patient.active === false ? 'Inactive' : 'Active'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">ID: {patient.id.slice(0, 8)}</Badge>
                  {patient.dateOfBirth && <Badge variant="outline">DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</Badge>}
                  {patient.gender && <Badge variant="secondary">{patient.gender}</Badge>}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Blood Type</p>
                    <p className="mt-2 text-2xl font-semibold text-teal-800">{patient.bloodType || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Login</p>
                    <p className="mt-2 text-xl font-semibold">{patient.lastLogin ? new Date(patient.lastLogin).toLocaleDateString() : 'Never'}</p>
                  </div>
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Allergies</p>
                    <p className="mt-2 text-xl font-semibold text-red-800">{patient.allergies || 'None listed'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk Level</p>
                    <p className="mt-2 text-xl font-semibold text-amber-700">{patient.allergies ? 'Moderate' : 'Standard'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 lg:flex-col">
                <Button variant="outline" className="rounded-2xl" onClick={startEditingProfile}>Edit Profile</Button>
                <Button className="rounded-2xl bg-teal-700 hover:bg-teal-800" onClick={() => { window.print(); }}>Export Records</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient Profile</CardTitle>
            <CardDescription>Demographics and active status</CardDescription>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-8 w-1/4" />
              </div>
            ) : !patient ? (
              <div className="text-sm text-muted-foreground">Patient not found.</div>
            ) : isEditingProfile ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blood Type</label>
                    <select
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={profileForm.bloodType}
                      onChange={(e) => setProfileForm({ ...profileForm, bloodType: e.target.value })}
                    >
                      <option value="">Select Blood Type</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <select
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <Input
                    type="date"
                    value={profileForm.dateOfBirth ? profileForm.dateOfBirth.split('T')[0] : ''}
                    onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Allergies</label>
                  <Input
                    value={profileForm.allergies}
                    onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Emergency Name</label>
                    <Input
                      value={profileForm.emergencyContactName}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Emergency Phone</label>
                    <Input
                      value={profileForm.emergencyContactPhone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Medical History</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={profileForm.medicalHistory}
                    onChange={(e) => setProfileForm({ ...profileForm, medicalHistory: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                  <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                </div>
              </div>
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
                {patient.phone && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Phone</p>
                    <p className="text-lg">{patient.phone}</p>
                  </div>
                )}
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
                {(patient.emergencyContactName || patient.emergencyContactPhone) && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Emergency Contact</p>
                    <p className="text-lg">{patient.emergencyContactName || 'N/A'} {patient.emergencyContactPhone ? `• ${patient.emergencyContactPhone}` : ''}</p>
                  </div>
                )}
                {patient.medicalHistory && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Medical History</p>
                    <p className="text-base text-muted-foreground">{patient.medicalHistory}</p>
                  </div>
                )}
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
            {pageLoading ? (
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
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-teal-700">
                        {new Date(record.recordDate || record.visitDate).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            router.push(`/${user?.role === 'ADMIN' ? 'admin' : 'doctor'}/records/${record.id}`);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEditing(record)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteRecord(record.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {editingRecordId === record.id ? (
                      <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                        <Input
                          value={editForm.diagnosis}
                          onChange={(event) => setEditForm({ ...editForm, diagnosis: event.target.value })}
                          placeholder="Diagnosis"
                        />
                        <Input
                          value={editForm.treatment}
                          onChange={(event) => setEditForm({ ...editForm, treatment: event.target.value })}
                          placeholder="Treatment"
                        />
                        <Input
                          value={editForm.prescription}
                          onChange={(event) => setEditForm({ ...editForm, prescription: event.target.value })}
                          placeholder="Prescription"
                        />
                        <textarea
                          value={editForm.notes}
                          onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                          placeholder="Notes"
                          className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingRecordId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium mt-1">Diagnosis: {record.diagnosis}</p>
                        {record.treatment && <p className="text-sm text-muted-foreground">Treatment: {record.treatment}</p>}
                        {record.notes && <p className="text-sm text-muted-foreground">Notes: {record.notes}</p>}
                        {record.prescription && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                            <p className="text-xs font-bold text-amber-800 uppercase">Prescription</p>
                            <p className="text-sm text-amber-900">{record.prescription}</p>
                          </div>
                        )}
                      </>
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
  const router = useRouter();
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{record.status}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/doctor/records/${record.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DoctorMedicalRecordDetailPage
// ============================================================================
export function DoctorMedicalRecordDetailPage({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user);
  const [record, setRecord] = useState<{
    id: string;
    diagnosis: string;
    treatment?: string;
    prescription?: string;
    notes?: string;
    testResults?: string;
    vitalSigns?: string;
    medicalRecordType?: string;
    recordDate?: string;
    visitDate?: string;
    followUpRequired?: boolean;
    followUpDate?: string;
    confidential?: boolean;
    patient?: { id?: string; fullName?: string };
    doctor?: { fullName?: string };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const basePath = user?.role === 'ADMIN' ? '/admin' : '/doctor';
  const patientId = record?.patient?.id;
  const backHref = patientId ? `${basePath}/patients/${patientId}` : `${basePath}/patients`;

  useEffect(() => {
    async function fetchRecord() {
      try {
        setIsLoading(true);
        const data = await getMedicalRecord(id);
        setRecord(data);
      } catch (err) {
        console.error('Error fetching medical record', err);
        setStatus('error');
        setStatusMessage(getFriendlyErrorMessage(err, 'Failed to load medical record'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecord();
  }, [id]);

  const visitDate = record?.recordDate || record?.visitDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Record Details"
        description="Full clinical encounter history for this patient."
        actionLabel="Back to Patient"
        actionHref={backHref}
      />
      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      {isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : !record ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Medical record not found.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{record.diagnosis}</CardTitle>
              <CardDescription>
                {visitDate ? new Date(visitDate).toLocaleString() : 'Date unavailable'}
                {record.medicalRecordType ? ` • ${record.medicalRecordType}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {record.treatment && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Treatment</p>
                  <p className="mt-1 text-base">{record.treatment}</p>
                </div>
              )}
              {record.prescription && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-800">Prescription</p>
                  <p className="mt-2 text-sm text-amber-900">{record.prescription}</p>
                </div>
              )}
              {record.testResults && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Test Results</p>
                  <p className="mt-1 whitespace-pre-wrap text-base">{record.testResults}</p>
                </div>
              )}
              {record.vitalSigns && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Vital Signs</p>
                  <p className="mt-1 whitespace-pre-wrap text-base">{record.vitalSigns}</p>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Clinical Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-muted-foreground">{record.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Encounter Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground">Patient</p>
                  <p className="mt-1 text-base">{record.patient?.fullName || 'Unknown'}</p>
                  {patientId && (
                    <Button
                      variant="ghost"
                      className="h-auto p-0 text-teal-700"
                      onClick={() => {
                        window.location.href = `${basePath}/patients/${patientId}`;
                      }}
                    >
                      View patient profile
                    </Button>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Attending Doctor</p>
                  <p className="mt-1 text-base">{record.doctor?.fullName || 'Unknown'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.confidential && <Badge variant="warning">Confidential</Badge>}
                  {record.followUpRequired && <Badge variant="outline">Follow-up required</Badge>}
                  {record.followUpDate && (
                    <Badge variant="secondary">Follow-up: {new Date(record.followUpDate).toLocaleDateString()}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
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

  const requestItems = useMemo(() => {
    return appointments
      .filter((item) => item.status === 'PENDING' || item.status === 'CONFIRMED')
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        patientName: item.patient.fullName,
        note: item.status === 'PENDING'
          ? `${item.type} request awaiting confirmation`
          : `${item.type} scheduled for ${item.time}`,
        received: item.time,
        status: item.status
      }));
  }, [appointments]);

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

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Requests</CardTitle>
              <Badge variant="default">{requestItems.length} New</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </>
              ) : requestItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  No current appointment requests.
                </div>
              ) : (
                requestItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { window.location.href = `/doctor/records/new?appointmentId=${item.id}`; }}
                    className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{item.patientName}</p>
                      <span className="text-xs text-muted-foreground">{item.received}</span>
                    </div>
                    <p className="mt-2 text-sm italic text-muted-foreground">"{item.note}"</p>
                    <Badge className="mt-3" variant={item.status === 'PENDING' ? 'warning' : 'outline'}>
                      {item.status}
                    </Badge>
                  </button>
                ))
              )}
              <Button variant="ghost" className="w-full text-teal-700" onClick={() => { window.location.href = '/doctor/appointments'; }}>
                View all requests
              </Button>
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
  const urlQuery = useSearchParams().get('q') ?? '';
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [editPrescriptionForm, setEditPrescriptionForm] = useState({ drugName: '', dosage: '', diagnosis: '', treatment: '', notes: '' });
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [newPrescriptionForm, setNewPrescriptionForm] = useState({
    patientName: '',
    drugName: '',
    dosage: '5mg',
    frequency: 'Once daily',
    duration: '14',
    instructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const fetchData = async (name?: string) => {
    if (!authUser?.id) return;
    try {
      setIsLoading(true);
      let data;
      if (name) {
        // Fetch specific patient's active prescriptions
        data = await listPrescriptionOrders({ patientName: name, size: 50 });
      } else {
        // Initial load: fetch doctor's recent orders to get the list of patient names
        data = await listPrescriptionOrdersByDoctor(authUser.id, { size: 100 });
      }
      setPrescriptions(data.content ?? []);
    } catch (err) {
      console.error("Failed to fetch prescriptions", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authUser?.id]);

  useEffect(() => {
    if (selectedPatientName) {
      fetchData(selectedPatientName);
    }
  }, [selectedPatientName]);

  const patientNames = useMemo(() => {
    return Array.from(new Set(prescriptions.map((item) => item.patientName).filter(Boolean))).sort();
  }, [prescriptions]);

  const visiblePrescriptions = useMemo(() => {
    if (!selectedPatientName) return [];
    return prescriptions.filter((item) => item.patientName === selectedPatientName);
  }, [prescriptions, selectedPatientName]);

  const filteredPrescriptions = useMemo(() => {
    if (!query.trim()) return visiblePrescriptions;
    const q = query.toLowerCase();
    return visiblePrescriptions.filter((item) => [item.drugName, item.patientName, item.status, item.dosage].some((value) => value.toLowerCase().includes(q)));
  }, [query, visiblePrescriptions]);

  const startPrescriptionEdit = (item: any) => {
    setEditingPrescriptionId(item.id);
    setEditPrescriptionForm({
      drugName: item.drugName,
      dosage: item.dosage,
      diagnosis: '',
      treatment: '',
      notes: item.instructions || ''
    });
    setStatus(null);
  };

  const handlePrescriptionEdit = async () => {
    if (!editingPrescriptionId) return;
    try {
      await updatePrescriptionOrder(editingPrescriptionId, {
        drugName: editPrescriptionForm.drugName,
        dosage: editPrescriptionForm.dosage,
        instructions: editPrescriptionForm.notes
      });
      setPrescriptions((current) => current.map((item) => item.id === editingPrescriptionId ? {
        ...item,
        drugName: editPrescriptionForm.drugName,
        dosage: editPrescriptionForm.dosage,
        instructions: editPrescriptionForm.notes
      } : item));
      setEditingPrescriptionId(null);
      setStatus('success');
      setStatusMessage('Prescription order updated successfully.');
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Failed to update prescription order.'));
    }
  };

  const handlePrescriptionDelete = async (id: string) => {
    if (!confirm('Delete this prescription order? This removes the order from the pharmacy system.')) return;
    try {
      await deletePrescriptionOrder(id);
      setPrescriptions((current) => current.filter((item) => item.id !== id));
      setStatus('success');
      setStatusMessage('Prescription order deleted successfully.');
    } catch (err) {
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Failed to delete prescription order.'));
    }
  };

  const handleSendToPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrescriptionForm.patientName || !newPrescriptionForm.drugName || !authUser?.id) {
      alert('Please fill in required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const finalInstructions = [
        `Frequency: ${newPrescriptionForm.frequency}`,
        `Duration: ${newPrescriptionForm.duration} days`,
        newPrescriptionForm.instructions
      ].filter(Boolean).join('\n');

      await apiClient.post('/prescription-orders', {
        doctorId: authUser.id,
        doctorName: authUser.fullName,
        patientName: newPrescriptionForm.patientName,
        drugName: newPrescriptionForm.drugName,
        dosage: newPrescriptionForm.dosage,
        instructions: finalInstructions
      });
      setNewPrescriptionForm({
        patientName: '',
        drugName: '',
        dosage: '5mg',
        frequency: 'Once daily',
        duration: '14',
        instructions: ''
      });
      alert('Prescription sent to pharmacy successfully!');
      // Refetch prescriptions
      fetchData();
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
      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
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
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                      value={newPrescriptionForm.dosage}
                      onChange={(e) => setNewPrescriptionForm({ ...newPrescriptionForm, dosage: e.target.value })}
                    >
                      <option value="5mg">5mg</option>
                      <option value="10mg">10mg</option>
                      <option value="25mg">25mg</option>
                      <option value="50mg">50mg</option>
                      <option value="100mg">100mg</option>
                      <option value="500mg">500mg</option>
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
                <CardDescription>Select a patient to list their active prescriptions</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                {patientNames.length === 0 && !isLoading ? (
                  <div className="text-sm text-muted-foreground">No patients with active prescriptions found.</div>
                ) : patientNames.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant={selectedPatientName === name ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => {
                      setSelectedPatientName(selectedPatientName === name ? '' : name);
                      setEditingPrescriptionId(null);
                    }}
                  >
                    {name}
                  </Button>
                ))}
              </div>
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
                    ) : !selectedPatientName ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Click a patient name above to list active prescriptions.
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
                          <TableCell className="font-medium">
                            {editingPrescriptionId === item.id ? (
                              <Input
                                value={editPrescriptionForm.drugName}
                                onChange={(event) => setEditPrescriptionForm({ ...editPrescriptionForm, drugName: event.target.value })}
                                className="h-9"
                              />
                            ) : item.drugName}
                          </TableCell>
                          <TableCell>{item.patientName}</TableCell>
                          <TableCell>
                            {editingPrescriptionId === item.id ? (
                              <Input
                                value={editPrescriptionForm.dosage}
                                onChange={(event) => setEditPrescriptionForm({ ...editPrescriptionForm, dosage: event.target.value })}
                                className="h-9"
                              />
                            ) : item.dosage}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === 'DISPENSED'
                                  ? 'success'
                                  : item.status === 'PENDING'
                                    ? 'warning'
                                    : item.status === 'REJECTED'
                                      ? 'destructive'
                                      : 'outline'
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {editingPrescriptionId === item.id ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handlePrescriptionEdit}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingPrescriptionId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => startPrescriptionEdit(item)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" className="h-8 rounded-lg" onClick={() => handlePrescriptionDelete(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            )}
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

// ============================================================================
// DoctorLaboratoryInvestigationsPage
//
// Manages laboratory investigations/orders. Doctors can:
// - Create new lab orders for patients with selected tests
// - View pending lab orders awaiting results
// - View completed lab orders with actual results
// - Download lab result files
// - Track order status through the laboratory workflow
// ============================================================================
export function DoctorLaboratoryInvestigationsPage() {
  const authUser = useAuthStore((state) => state.user);
  const [patients, setPatients] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    patientId: string;
    tests: string[];
    urgency: (typeof LAB_URGENCY)[number];
    clinicalNotes: string;
  }>({
    patientId: '',
    tests: [] as string[],
    urgency: 'routine',
    clinicalNotes: ''
  });

  const labTestTypes = [
    'Blood Test',
    'Urinalysis',
    'Complete Blood Count (CBC)',
    'Blood Chemistry',
    'Liver Function Test',
    'Kidney Function Test',
    'Thyroid Function Test',
    'Lipid Profile',
    'Blood Glucose Test',
    'Coagulation Test',
    'Pregnancy Test',
    'COVID-19 Test',
    'Malaria Test',
    'Blood Culture',
    'Bacterial Culture'
  ];

  // Load patients and lab orders on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch patients
        const patientsRes = await listPatients({ size: 100 });
        setPatients(patientsRes.content || []);
        
        // Fetch lab orders for this doctor
        if (authUser?.id) {
          try {
            const ordersRes = await labOrdersService.list({ doctorId: authUser.id, size: 50 });
            const orders: Array<{ id: string }> = ordersRes?.content || [];
            setLabOrders(orders);
            
            // Fetch results for each order in parallel
            const resultsMap = new Map<string, any>();
            const resultPromises = orders.map(order =>
              labResultsService.getByLabOrderId(order.id)
                .then(result => {
                  if (result) {
                    resultsMap.set(order.id, result);
                  }
                })
                .catch(() => {
                  // Result might not exist yet - silent fail
                })
            );
            
            await Promise.all(resultPromises);
            setLabResults(resultsMap);
          } catch (err) {
            console.error('Failed to load lab orders:', err);
            setLabOrders([]);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setStatus('error');
        setStatusMessage(getFriendlyErrorMessage(err, 'Could not load laboratory data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authUser?.id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patientId || formData.tests.length === 0) {
      setStatus('error');
      setStatusMessage('Please select a patient and at least one test');
      return;
    }

    if (!authUser?.id) {
      setStatus('error');
      setStatusMessage('Your doctor profile is not available yet. Please refresh and try again.');
      return;
    }

    try {
      setIsCreating(true);
      const orderData = {
        patientId: formData.patientId,
        doctorId: authUser.id,
        tests: formData.tests,
        urgency: formData.urgency,
        clinicalNotes: formData.clinicalNotes
      };

      await labOrdersService.create(orderData);
      
      setStatus('success');
      setStatusMessage('Laboratory order created successfully!');
      setShowCreateForm(false);
      setFormData({
        patientId: '',
        tests: [],
        urgency: 'routine',
        clinicalNotes: ''
      });
      
      // Refresh lab orders after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Failed to create order:', err);
      setStatus('error');
      setStatusMessage(getFriendlyErrorMessage(err, 'Could not create laboratory order'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleTestToggle = (test: string) => {
    setFormData(prev => ({
      ...prev,
      tests: prev.tests.includes(test)
        ? prev.tests.filter(t => t !== test)
        : [...prev.tests, test]
    }));
  };

  const pendingOrders = labOrders.filter(order => 
    order.status === 'pending' || order.status === 'in_progress' || order.status === 'PENDING' || order.status === 'IN_PROGRESS'
  );
  
  const completedOrders = labOrders.filter(order => 
    order.status === 'completed' || order.status === 'COMPLETED'
  );

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.fullName || patient?.name || patientId;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Investigations"
        description="Create and track patient laboratory orders and results."
        actionLabel="New Lab Order"
        onAction={() => setShowCreateForm(true)}
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      {/* Create Lab Order Form */}
      {showCreateForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Create New Laboratory Order</CardTitle>
            <CardDescription>
              Select a patient and the tests to be performed in the laboratory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Patient Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Patient *</label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                  required
                >
                  <option value="">Choose a patient...</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName || patient.name} ({patient.id?.substring(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Tests *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-3 border rounded-lg bg-slate-50">
                  {labTestTypes.map(test => (
                    <label key={test} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.tests.includes(test)}
                        onChange={() => handleTestToggle(test)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{test}</span>
                    </label>
                  ))}
                </div>
                {formData.tests.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {formData.tests.length} test(s)
                  </div>
                )}
              </div>

              {/* Urgency */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency Level</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as (typeof LAB_URGENCY)[number] })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Clinical Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Clinical Notes</label>
                <textarea
                  value={formData.clinicalNotes}
                  onChange={(e) => setFormData({...formData, clinicalNotes: e.target.value})}
                  placeholder="Any clinical notes or observations for the lab..."
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !formData.patientId || formData.tests.length === 0}>
                  {isCreating ? 'Creating...' : 'Create Lab Order'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700">{labOrders.length}</div>
            <p className="text-xs text-muted-foreground">All lab orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting results</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedOrders.length}</div>
            <p className="text-xs text-muted-foreground">Results available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ready to Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completedOrders.filter(o => labResults.has(o.id)).length}</div>
            <p className="text-xs text-muted-foreground">Results received</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </div>
      ) : (
        <>
          {/* Pending Lab Orders */}
          {pendingOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Laboratory Orders</CardTitle>
                <CardDescription>Orders awaiting laboratory results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="p-4 border rounded-lg hover:bg-slate-50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            Patient: {getPatientName(order.patientId)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Tests: {Array.isArray(order.tests) ? order.tests.join(', ') : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {formatDate(order.createdAt)}
                          </div>
                          {order.clinicalNotes && (
                            <div className="text-sm mt-2 p-2 bg-slate-100 rounded">
                              <strong>Notes:</strong> {order.clinicalNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={order.urgency === 'routine' ? 'secondary' : order.urgency === 'urgent' ? 'outline' : 'destructive'}>
                            {order.urgency?.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">
                            {order.status?.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Lab Orders with Results */}
          {completedOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Completed Laboratory Orders</CardTitle>
                <CardDescription>Orders with available results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedOrders.map((order) => {
                    const result = labResults.get(order.id);
                    const isExpanded = expandedOrderId === order.id;

                    return (
                      <div key={order.id} className="border rounded-lg overflow-hidden">
                        <div 
                          className="p-4 bg-gradient-to-r from-green-50 to-teal-50 cursor-pointer hover:from-green-100 hover:to-teal-100 transition"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">
                                Patient: {getPatientName(order.patientId)}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Tests: {Array.isArray(order.tests) ? order.tests.join(', ') : 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Order Date: {formatDate(order.createdAt)}
                              </div>
                              {result && (
                                <div className="text-xs text-green-700 font-medium mt-1">
                                  ✓ Result Available - {formatDate(result.submittedAt || result.updatedAt)}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="success">Completed</Badge>
                              {result && (
                                <Badge variant={result.status === 'final' ? 'success' : 'secondary'}>
                                  {result.status?.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Result Details */}
                        {isExpanded && result && (
                          <div className="p-4 border-t bg-slate-50">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Laboratory Findings</h4>
                                {typeof result.findings === 'object' && result.findings !== null ? (
                                  <div className="space-y-2">
                                    {Object.entries(result.findings).map(([key, value]) => (
                                      <div key={key} className="p-3 bg-white rounded border">
                                        <div className="font-medium text-sm">{key}</div>
                                        <div className="text-sm text-slate-600">{String(value)}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-3 bg-white rounded border">
                                    <div className="text-sm">{String(result.findings)}</div>
                                  </div>
                                )}
                              </div>

                              {result.fileUrl && (
                                <div>
                                  <h4 className="font-medium mb-2">Attachments</h4>
                                  <a 
                                    href={result.fileUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 transition"
                                  >
                                    📎 Download Lab Report
                                  </a>
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground">
                                <div>Result ID: {result.id?.substring(0, 8)}...</div>
                                <div>Lab Technician: {result.labTechnicianId?.substring(0, 8)}...</div>
                                <div>Status: {result.status?.toUpperCase()}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {labOrders.length === 0 && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Beaker className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No Laboratory Orders</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first laboratory order to get started
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  Create New Lab Order
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// DoctorLabInvestigationsPage
//
// Allows doctors to:
//  1. Create new lab investigation orders linked to patients
//  2. View all their submitted lab orders with real-time status
//  3. Fetch and inspect the detailed lab result for any completed order
// ============================================================================

interface LabOrderRow {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  tests: string[];
  urgency: string;
  clinicalNotes?: string;
  status: string;
  createdAt: string;
}

interface LabResultDetail {
  id: string;
  labOrderId: string;
  labTechnicianId?: string;
  findings: Record<string, string> | string;
  fileUrl?: string | null;
  status: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export function DoctorLabInvestigationsPage() {
  const user = useAuthStore((s) => s.user);

  // ── Order list state ──────────────────────────────────────────────────────
  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // ── Create-order form state ───────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<string>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<StatusType>(null);
  const [formStatusMessage, setFormStatusMessage] = useState('');

  // ── Result-detail modal state ─────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<LabOrderRow | null>(null);
  const [result, setResult] = useState<LabResultDetail | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // ── Fetch all lab orders for this doctor ─────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoadingOrders(true);
      setOrdersError(null);
      const data = await labOrdersService.list({ doctorId: user.id, size: 50 });
      const items: LabOrderRow[] = (Array.isArray(data)
        ? data
        : (data as any)?.content ?? []
      ).map((o: any) => ({
        id: o.id,
        patientId: o.patientId,
        patientName: o.patientName ?? o.patientId,
        doctorId: o.doctorId,
        tests: Array.isArray(o.tests) ? o.tests : [],
        urgency: o.urgency ?? 'routine',
        clinicalNotes: o.clinicalNotes,
        status: o.status ?? 'PENDING',
        createdAt: o.createdAt,
      }));
      setOrders(items);
    } catch (err) {
      setOrdersError(getFriendlyErrorMessage(err, 'Could not load lab orders.'));
    } finally {
      setIsLoadingOrders(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await listPatients({ size: 100 });
        setPatients(data.content ?? []);
      } catch { /* silent */ }
    }
    loadPatients();
  }, []);

  // ── Submit new lab order ──────────────────────────────────────────────────
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPatientName = patientSearchInput.trim();
    if (!user?.id || !finalPatientName || selectedTests.length === 0) {
      setFormStatus('error');
      setFormStatusMessage('Please write a patient name and select at least one test.');
      return;
    }

    // Resolve patientId: if typed name matches a registered patient, link by UUID. Otherwise use raw typed name string!
    const matchedPatient = patients.find(
      (p) => p.fullName?.toLowerCase() === finalPatientName.toLowerCase()
    );
    const finalPatientId = matchedPatient ? matchedPatient.id : finalPatientName;

    try {
      setIsSubmitting(true);
      setFormStatus(null);
      await labOrdersService.create({
        patientId: finalPatientId,
        doctorId: user.id,
        tests: selectedTests,
        urgency: urgency ? (urgency.toUpperCase() as any) : 'ROUTINE',
        clinicalNotes: clinicalNotes.trim() || 'Routine investigation ordered by doctor.',
      });
      setFormStatus('success');
      setFormStatusMessage('Lab order created and sent to laboratory successfully!');
      setShowCreateForm(false);
      setSelectedPatientId('');
      setPatientSearchInput('');
      setSelectedTests([]);
      setUrgency('routine');
      setClinicalNotes('');
      await fetchOrders();
    } catch (err) {
      setFormStatus('error');
      setFormStatusMessage(getFriendlyErrorMessage(err, 'Failed to create lab order.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Open result detail modal and fetch real result ────────────────────────
  const openResultDetail = async (order: LabOrderRow) => {
    setSelectedOrder(order);
    setResult(null);
    setResultError(null);
    setIsLoadingResult(true);
    try {
      const r = await labResultsService.getByLabOrderId(order.id);
      setResult(r as LabResultDetail | null);
    } catch (err) {
      setResultError(getFriendlyErrorMessage(err, 'Could not load lab result.'));
    } finally {
      setIsLoadingResult(false);
    }
  };

  const toggleTest = (test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const urgencyBadge = (u: string): 'destructive' | 'warning' | 'outline' => {
    if (u === 'critical') return 'destructive';
    if (u === 'urgent') return 'warning';
    return 'outline';
  };

  const statusBadge = (s: string): 'success' | 'default' | 'destructive' | 'warning' => {
    const sl = (s ?? '').toLowerCase();
    if (sl === 'completed') return 'success';
    if (sl === 'in_progress') return 'default';
    if (sl === 'cancelled') return 'destructive';
    return 'warning';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Investigations"
        description="Create investigation orders and review real laboratory results."
        actionLabel="New Lab Order"
        onAction={() => { setShowCreateForm((v) => !v); setFormStatus(null); }}
      />

      <StatusAlert
        status={formStatus}
        message={formStatusMessage}
        onDismiss={() => setFormStatus(null)}
        autoDismiss
        autoDismissMs={4000}
      />

      {/* ── Create Lab Order Form ─────────────────────────────────── */}
      {showCreateForm && (
        <Card className="border-teal-300 shadow-md">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-white border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-teal-700" />
                <CardTitle>New Lab Investigation Order</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Select a patient, choose the required tests, set urgency and add clinical notes.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleCreateOrder} className="space-y-5">
              {/* Patient */}
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold">Patient Name *</label>
                <Input
                  type="text"
                  placeholder="Write patient's name..."
                  className="h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:ring-teal-500"
                  value={patientSearchInput}
                  onChange={(e) => {
                    setPatientSearchInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  required
                />
                
                {/* Suggestions Autocomplete Box */}
                {showSuggestions && patientSearchInput.trim().length > 0 && (
                  (() => {
                    const filtered = patients.filter((p) =>
                      p.fullName?.toLowerCase().includes(patientSearchInput.toLowerCase())
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-lg divide-y divide-gray-100">
                        {filtered.map((p) => (
                          <div
                            key={p.id}
                            className="px-4 py-2.5 hover:bg-teal-50 text-sm cursor-pointer transition-colors text-gray-700 flex justify-between items-center"
                            onClick={() => {
                              setPatientSearchInput(p.fullName);
                              setSelectedPatientId(p.id);
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="font-medium">{p.fullName}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Registered</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Test selection – checkbox grid */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Tests to Order *</label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {LAB_TEST_TYPES.map((test) => (
                    <label
                      key={test}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                        selectedTests.includes(test)
                          ? 'border-teal-500 bg-teal-50 font-medium text-teal-800'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-600"
                        checked={selectedTests.includes(test)}
                        onChange={() => toggleTest(test)}
                      />
                      {test}
                    </label>
                  ))}
                </div>
                {selectedTests.length > 0 && (
                  <p className="text-xs text-teal-700 font-medium">
                    Selected: {selectedTests.join(' • ')}
                  </p>
                )}
              </div>

              {/* Urgency */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Urgency Level *</label>
                <div className="flex gap-3">
                  {LAB_URGENCY.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium capitalize transition-colors ${
                        urgency === u
                          ? u === 'critical'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : u === 'urgent'
                              ? 'border-amber-500 bg-amber-50 text-amber-700'
                              : 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Clinical Notes</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Relevant clinical context, symptoms, or indications for these tests..."
                  className="min-h-[90px] w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="rounded-2xl bg-teal-700 px-8 hover:bg-teal-800"
                  disabled={isSubmitting || selectedTests.length === 0 || !patientSearchInput.trim()}
                >
                  {isSubmitting ? 'Sending to Lab...' : 'Submit Lab Order'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Orders Table ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-teal-700" />
              <div>
                <CardTitle>My Lab Orders</CardTitle>
                <CardDescription>All investigation orders you have submitted</CardDescription>
              </div>
            </div>
            <Badge variant="outline">{orders.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingOrders ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : ordersError ? (
            <p className="p-6 text-sm text-destructive">{ordersError}</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
              <Beaker className="h-12 w-12 opacity-30" />
              <p className="text-sm">No lab orders found. Click "New Lab Order" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Patient</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      {order.patientName ?? order.patientId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {order.tests.slice(0, 2).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                        {order.tests.length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{order.tests.length - 2} more</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={urgencyBadge(order.urgency)} className="capitalize">
                        {order.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(order.status)} className="capitalize">
                        {(order.status ?? '').toLowerCase().replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={(order.status ?? '').toLowerCase() === 'completed' ? 'default' : 'outline'}
                        className="rounded-xl"
                        onClick={() => openResultDetail(order)}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" />
                        {(order.status ?? '').toLowerCase() === 'completed' ? 'View Result' : 'Details'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Result Detail Modal ───────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-teal-50 to-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                  <Beaker className="h-5 w-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Lab Result Detail</h3>
                  <p className="text-sm text-muted-foreground">
                    Patient: <span className="font-medium">{selectedOrder.patientName ?? selectedOrder.patientId}</span>
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => { setSelectedOrder(null); setResult(null); }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Order summary */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Urgency</p>
                  <Badge variant={urgencyBadge(selectedOrder.urgency)} className="mt-1 capitalize">
                    {selectedOrder.urgency}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Status</p>
                  <Badge variant={statusBadge(selectedOrder.status)} className="mt-1 capitalize">
                    {(selectedOrder.status ?? '').toLowerCase().replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ordered</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tests Ordered</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedOrder.tests.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
              {selectedOrder.clinicalNotes && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinical Notes</p>
                  <p className="mt-1 text-sm text-muted-foreground italic">"{selectedOrder.clinicalNotes}"</p>
                </div>
              )}
            </div>

            {/* Lab result content */}
            <div className="max-h-[48vh] overflow-y-auto px-6 py-5 space-y-4">
              {isLoadingResult ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : resultError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {resultError}
                </div>
              ) : !result ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                  <FlaskConical className="h-12 w-12 opacity-25" />
                  <p className="text-sm font-medium">No result available yet</p>
                  <p className="text-xs">The laboratory has not submitted results for this order yet.</p>
                </div>
              ) : (
                <>
                  {/* Result meta */}
                  <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        Result Status: <span className="capitalize">{result.status}</span>
                      </p>
                      {result.submittedAt && (
                        <p className="text-xs text-green-700 mt-0.5">
                          Submitted: {new Date(result.submittedAt).toLocaleString()}
                        </p>
                      )}
                      {result.labTechnicianId && (
                        <p className="text-xs text-green-700 mt-0.5">
                          Lab Technician ID: {result.labTechnicianId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Findings */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-600" />
                      Laboratory Findings
                    </h4>
                    {typeof result.findings === 'string' ? (
                      <div className="rounded-2xl border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                        {result.findings}
                      </div>
                    ) : result.findings && typeof result.findings === 'object' && Object.keys(result.findings).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(result.findings).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between rounded-xl border border-border bg-muted/20 px-4 py-3"
                          >
                            <span className="text-sm font-semibold text-slate-700">{key}</span>
                            <span className="ml-4 text-sm text-slate-900 text-right max-w-[60%]">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No structured findings recorded.</p>
                    )}
                  </div>

                  {/* File attachment */}
                  {result.fileUrl && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-2">Attached Report</p>
                      <a
                        href={result.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Download / View Lab Report
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex justify-end">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => { setSelectedOrder(null); setResult(null); }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
