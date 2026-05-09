"use client";

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, CalendarCheck2, Clock3, FileText, MapPin, Search, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layouts/page-header';
import { createAppointment, listAppointments } from '@/services/api/appointments';
import { listMedicalRecords, searchMedicalRecords } from '@/services/api/medical-records';
import { listPrescriptions } from '@/services/api/prescriptions';
import { listDoctors } from '@/services/api/users';
import { useAuthStore } from '@/store/auth-store';

type CountState = {
  appointments: number;
  records: number;
  prescriptions: number;
};

const demoDoctors = [
  { name: 'Dr. Sarah Jenkins', specialty: 'Senior Cardiologist', location: 'Main Medical Plaza', slot: 'Tomorrow, 09:30', rating: '4.9' },
  { name: 'Dr. Michael Chen', specialty: 'Neurologist', location: 'East Wing Health Hub', slot: 'Wed, 14:00', rating: '4.8' },
  { name: 'Dr. Elena Rodriguez', specialty: 'Family Medicine', location: 'Downtown Clinic', slot: 'Fri, 10:00', rating: '5.0' }
];

export function PatientDashboardPage() {
  const [counts, setCounts] = useState<CountState>({ appointments: 0, records: 0, prescriptions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const params = user ? { patientId: user.id, size: 10 } : { size: 10 };
        const [appointmentData, medicalData, prescriptionData] = await Promise.all([
          listAppointments(params),
          user ? searchMedicalRecords(params) : listMedicalRecords(params),
          listPrescriptions(params)
        ]);

        setCounts({
          appointments: appointmentData.totalElements ?? appointmentData.content?.length ?? 0,
          records: medicalData.totalElements ?? medicalData.content?.length ?? 0,
          prescriptions: prescriptionData.totalElements ?? prescriptionData.content?.length ?? 0
        });
      } catch {
        setCounts({ appointments: 0, records: 0, prescriptions: 0 });
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Dashboard"
        description="See appointments, care updates, and personal health records in one place."
        actionLabel="Book Appointment"
        actionHref="/patient/book-appointment"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Visits</CardTitle>
            <CardDescription>{isLoading ? 'Loading...' : `${counts.appointments} scheduled`}</CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarCheck2 className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medical Records</CardTitle>
            <CardDescription>{isLoading ? 'Loading...' : `${counts.records} documents`}</CardDescription>
          </CardHeader>
          <CardContent>
            <FileText className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prescriptions</CardTitle>
            <CardDescription>{isLoading ? 'Loading...' : `${counts.prescriptions} active or historical`}</CardDescription>
          </CardHeader>
          <CardContent>
            <Bell className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PatientBookingPage() {
  const router = useRouter();
  const search = useSearchParams();
  const selectedDoctorId = search.get('doctorId') ?? '';
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [realDoctors, setRealDoctors] = useState<any[]>([]);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const data = await listDoctors({ size: 50 });
        setRealDoctors((data.content ?? []).map((d: any) => ({
          id: d.id,
          name: d.fullName,
          specialty: d.specialization || 'Specialist',
          location: 'Clinic Center',
          slot: 'Available today',
          rating: '5.0'
        })));
      } catch (err) {
        console.error("Failed to fetch doctors", err);
      }
    }
    fetchDoctors();
  }, []);

  const selectedDoctor = useMemo(() => realDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null, [realDoctors, selectedDoctorId]);

  const filteredDoctors = useMemo(() => {
    const pool = realDoctors.length > 0 ? realDoctors : demoDoctors;
    if (!query.trim()) return pool;
    const q = query.toLowerCase();
    return pool.filter((d) => 
      d.name.toLowerCase().includes(q) || 
      d.specialty.toLowerCase().includes(q)
    );
  }, [query, realDoctors]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDoctor || !date || !time || !reason.trim() || !user) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createAppointment({
        patientId: user.id,
        doctorId: selectedDoctor.id,
        appointmentDate: `${date}T${time}:00`,
        duration: 30,
        status: 'SCHEDULED',
        reasonForVisit: reason.trim()
      });
      router.push('/patient/appointments');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Find your specialist" description="Choose from available doctors and book a visit." />
      <Card>
        <CardContent className="space-y-6 p-6">
          {!selectedDoctor ? (
            <>
              <div className="flex gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  placeholder="Search by name, specialty or clinic..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredDoctors.map((doctor) => (
                  <div key={doctor.id ?? doctor.name} className="rounded-3xl border border-border bg-muted/10 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{doctor.name}</p>
                        <p className="text-sm text-teal-700">{doctor.specialty}</p>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        <Star className="h-3 w-3 fill-current" /> {doctor.rating}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {doctor.location}</div>
                      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> {doctor.slot}</div>
                    </div>
                    <Button
                      className="mt-4 w-full rounded-2xl"
                      onClick={() => router.push(`/patient/book-appointment?doctorId=${encodeURIComponent(doctor.id)}`)}
                    >
                      Book appointment
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="rounded-3xl border border-border bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Selected Doctor</p>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{selectedDoctor.name}</div>
                    <p className="text-sm text-teal-700">{selectedDoctor.specialty}</p>
                  </div>
                  <Badge variant="success">Available</Badge>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-0 shadow-none">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-2xl text-slate-900">Select Date &amp; Time</CardTitle>
                    <CardDescription>Choose a day and an available slot that works for you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 px-0 pb-0">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Date</label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-2xl" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Time</label>
                        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-2xl" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Reason</label>
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for visit" className="h-11 rounded-2xl" />
                    </div>

                    <div className="flex flex-wrap gap-3 rounded-3xl border border-border bg-muted/20 p-4">
                      {['09:00 AM', '10:30 AM', '01:45 PM', '03:00 PM'].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            const normalized = slot.replace(' AM', '').replace(' PM', '');
                            const [hourMinute, suffix] = [normalized, slot.includes('PM') ? 'PM' : 'AM'];
                            const [hour, minute] = hourMinute.split(':');
                            const hour24 = suffix === 'PM' && Number(hour) !== 12 ? String(Number(hour) + 12).padStart(2, '0') : String(hour).padStart(2, '0');
                            setTime(`${hour24}:${minute}`);
                          }}
                          className={`rounded-full border px-4 py-2 text-sm transition ${selectedSlot === slot ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-foreground'}`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit" className="rounded-2xl" disabled={isSubmitting}>
                        {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => router.push('/patient/book-appointment')}>Back</Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Available Slots</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {['09:00 AM', '10:30 AM', '01:45 PM', '03:00 PM'].map((slot) => (
                        <div key={slot} className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
                          {slot}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Array<{ id: string; reason: string; status: string; scheduledAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listAppointments(user ? { patientId: user.id, size: 30 } : { size: 30 });
        setAppointments((data.content ?? []).map((a: any) => ({
          id: a.id,
          reason: a.reasonForVisit || a.reason,
          status: a.status,
          scheduledAt: a.appointmentDate || a.scheduledAt
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Appointment History" description="Track upcoming and completed visits." actionLabel="Book New" actionHref="/patient/book-appointment" />
      <Card>
        <CardContent className="space-y-3 p-6">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading appointments...</div> : null}
          {!isLoading && appointments.length === 0 ? <div className="text-sm text-muted-foreground">No appointments found.</div> : null}
          {!isLoading
            ? appointments.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                  <span>{item.reason} - {new Date(item.scheduledAt).toLocaleString()}</span>
                  <Badge variant={item.status === 'CONFIRMED' ? 'success' : item.status === 'PENDING' ? 'warning' : 'outline'}>{item.status}</Badge>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientRecordsPage() {
  const [records, setRecords] = useState<Array<{ id: string; diagnosis: string; status: string; visitDate: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await searchMedicalRecords(user ? { patientId: user.id, size: 30 } : { size: 30 });
        setRecords((data.content ?? []).map((r) => ({
          id: r.id,
          diagnosis: r.diagnosis,
          status: (r.status || r.medicalRecordType || 'SIGNED') as string,
          visitDate: (r.recordDate || r.visitDate || new Date().toISOString()) as string
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Medical Records" description="Access charts, labs, and diagnoses in one place." />
      <Card>
        <CardContent className="space-y-3 p-6">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading records...</div> : null}
          {!isLoading && records.length === 0 ? <div className="text-sm text-muted-foreground">No records found.</div> : null}
          {!isLoading
            ? records.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                  <span>{record.diagnosis} - {new Date(record.visitDate).toLocaleDateString()}</span>
                  <Badge variant="outline">{record.status}</Badge>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; drugName: string; status: string; prescribedAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listPrescriptions(user ? { patientId: user.id, size: 30 } : { size: 30 });
        setPrescriptions((data.content ?? []).map((p) => ({
          id: p.id,
          drugName: p.drugName,
          status: p.status,
          prescribedAt: p.prescribedAt
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Prescriptions" description="Review active medications and refill instructions." />
      <Card>
        <CardContent className="space-y-3 p-6">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading prescriptions...</div> : null}
          {!isLoading && prescriptions.length === 0 ? <div className="text-sm text-muted-foreground">No prescriptions found.</div> : null}
          {!isLoading
            ? prescriptions.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                  <span>{item.drugName} - {new Date(item.prescribedAt).toLocaleDateString()}</span>
                  <Badge variant={item.status === 'ACTIVE' ? 'success' : item.status === 'PENDING' ? 'warning' : 'outline'}>{item.status}</Badge>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <PageHeader title="Patient Profile" description="Review your account and care details." actionLabel="View Appointments" actionHref="/patient/appointments" />
      <Card>
        <CardHeader>
          <CardTitle>{user?.fullName ?? 'Patient'}</CardTitle>
          <CardDescription>{user?.email ?? 'No email available'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/50 p-4">Role: {user?.role ?? 'PATIENT'}</div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => router.push('/patient/records')}>Open Medical Records</Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => router.push('/patient/prescriptions')}>Open Prescriptions</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientNotificationsPage() {
  const [items, setItems] = useState<string[]>([]);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      const data = await listAppointments(user ? { patientId: user.id, size: 5 } : { size: 5 });
      const notifications = (data.content ?? []).map((a) => `Appointment ${a.status.toLowerCase()}: ${a.reason}`);
      setItems(notifications);
    }
    fetchData().catch(() => setItems([]));
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="View reminders, results, and care team updates." />
      <Card>
        <CardContent className="space-y-3 p-6">
          {items.length === 0 ? <div className="rounded-2xl bg-muted/50 p-4">No new notifications</div> : null}
          {items.map((item) => (
            <div key={item} className="rounded-2xl bg-muted/50 p-4">{item}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
