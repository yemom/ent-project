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
import { listPrescriptions } from '@/features/prescriptions';
import { getPatient, listDoctors } from '@/services/api/users';
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
  const urlQuery = search.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [realDoctors, setRealDoctors] = useState<any[]>([]);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

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
        // Silent fail - demo doctors will be shown as fallback
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
  const urlQuery = useSearchParams().get('q') ?? '';
  const [appointments, setAppointments] = useState<Array<{ id: string; reason: string; status: string; scheduledAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const filteredAppointments = useMemo(() => {
    if (!urlQuery.trim()) return appointments;
    const q = urlQuery.toLowerCase();
    return appointments.filter((appointment) =>
      [appointment.reason, appointment.status, appointment.scheduledAt].some((value) => value.toLowerCase().includes(q))
    );
  }, [appointments, urlQuery]);

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
          {!isLoading && filteredAppointments.length === 0 ? <div className="text-sm text-muted-foreground">No appointments found.</div> : null}
          {!isLoading
            ? filteredAppointments.map((item) => (
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
  const urlQuery = useSearchParams().get('q') ?? '';
  const [records, setRecords] = useState<Array<{ id: string; diagnosis: string; status: string; visitDate: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const filteredRecords = useMemo(() => {
    if (!urlQuery.trim()) return records;
    const q = urlQuery.toLowerCase();
    return records.filter((record) => [record.diagnosis, record.status, record.visitDate].some((value) => value.toLowerCase().includes(q)));
  }, [records, urlQuery]);

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
          {!isLoading && filteredRecords.length === 0 ? <div className="text-sm text-muted-foreground">No records found.</div> : null}
          {!isLoading
            ? filteredRecords.map((record) => (
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
  const urlQuery = useSearchParams().get('q') ?? '';
  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; drugName: string; status: string; prescribedAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const filteredPrescriptions = useMemo(() => {
    if (!urlQuery.trim()) return prescriptions;
    const q = urlQuery.toLowerCase();
    return prescriptions.filter((prescription) =>
      [prescription.drugName, prescription.status, prescription.prescribedAt].some((value) => value.toLowerCase().includes(q))
    );
  }, [prescriptions, urlQuery]);

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
          {!isLoading && filteredPrescriptions.length === 0 ? <div className="text-sm text-muted-foreground">No prescriptions found.</div> : null}
          {!isLoading
            ? filteredPrescriptions.map((item) => (
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
  const [profile, setProfile] = useState<any | null>(null);
  const [records, setRecords] = useState<Array<{ id: string; diagnosis: string; treatment?: string; prescription?: string; status: string; visitDate: string; doctorName?: string }>>([]);
  const [prescriptions, setPrescriptions] = useState<Array<{ id: string; drugName: string; status: string; prescribedAt: string }>>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string; reason: string; scheduledAt: string; doctorName?: string }>>([]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) return;
      const [patientData, recordData, prescriptionData, appointmentData] = await Promise.all([
        getPatient(user.id).catch(() => null),
        searchMedicalRecords({ patientId: user.id, size: 5 }).catch(() => ({ content: [] })),
        listPrescriptions({ patientId: user.id, size: 5 }).catch(() => ({ content: [] })),
        listAppointments({ patientId: user.id, size: 5 }).catch(() => ({ content: [] }))
      ]);
      setProfile(patientData);
      setRecords((recordData.content ?? []).map((record: any) => ({
        id: record.id,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        prescription: record.prescription,
        status: record.status || record.medicalRecordType || 'Completed',
        visitDate: record.recordDate || record.visitDate || new Date().toISOString(),
        doctorName: record.doctor?.fullName || record.doctorName
      })));
      setPrescriptions((prescriptionData.content ?? []).map((item: any) => ({
        id: item.id,
        drugName: item.drugName,
        status: item.status,
        prescribedAt: item.prescribedAt
      })));
      setAppointments((appointmentData.content ?? []).map((item: any) => ({
        id: item.id,
        reason: item.reasonForVisit || item.reason || 'Appointment',
        scheduledAt: item.appointmentDate || item.scheduledAt,
        doctorName: item.doctor?.fullName || item.doctorName
      })));
    }
    fetchProfile();
  }, [user?.id]);

  const currentProfile = profile ?? user;
  const allergies = profile?.allergies || 'None listed';
  const bloodType = profile?.bloodType || 'N/A';
  const lastVisit = appointments[0]?.scheduledAt || records[0]?.visitDate;

  return (
    <div className="space-y-8">
      <PageHeader title="Patient Profile" description="Review your account and care details." actionLabel="View Appointments" actionHref="/patient/appointments" />

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-white via-white to-teal-50 shadow-sm">
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-[150px_1fr_auto]">
            <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-teal-100 text-4xl font-bold text-teal-800">
              {(currentProfile?.fullName ?? 'Patient').split(' ').map((part: string) => part[0]).slice(0, 2).join('')}
            </div>
            <div>
              <h2 className="text-4xl font-bold text-slate-950">{currentProfile?.fullName ?? 'Patient'}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">ID: {(currentProfile?.id ?? user?.id ?? '').slice(0, 8)}</Badge>
                {profile?.dateOfBirth && <Badge variant="outline">DOB: {new Date(profile.dateOfBirth).toLocaleDateString()}</Badge>}
                {profile?.gender && <Badge variant="secondary">{profile.gender}</Badge>}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Blood Type</p>
                  <p className="mt-2 text-2xl font-semibold text-teal-800">{bloodType}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Visit</p>
                  <p className="mt-2 text-xl font-semibold">{lastVisit ? new Date(lastVisit).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Allergies</p>
                  <p className="mt-2 text-xl font-semibold text-red-800">{allergies}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk Level</p>
                  <p className="mt-2 text-xl font-semibold text-amber-700">{profile?.allergies ? 'Moderate' : 'Standard'}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 lg:flex-col">
              <Button variant="outline" className="rounded-2xl">Edit Profile</Button>
              <Button className="rounded-2xl bg-teal-700 hover:bg-teal-800" onClick={() => router.push('/patient/records')}>Export Records</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex gap-6 border-b">
            {['Clinical Timeline', 'Documents & Scans', 'Medications', 'Lab Results'].map((tab, index) => (
              <button key={tab} className={`pb-4 text-lg ${index === 0 ? 'border-b-2 border-teal-700 font-semibold text-teal-800' : 'text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-2xl">Recent Activity</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Add Note</Button>
                <Button variant="outline" size="sm">Upload Document</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {records.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No clinical activity found.</div>
              ) : records.map((record) => (
                <div key={record.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{record.diagnosis}</p>
                      <p className="text-sm text-muted-foreground">{new Date(record.visitDate).toLocaleDateString()} • {record.doctorName || 'Care Team'}</p>
                    </div>
                    <Badge variant="success">{record.status}</Badge>
                  </div>
                  {record.treatment && <p className="mt-4 text-sm text-slate-700">{record.treatment}</p>}
                  {record.prescription && <p className="mt-3 text-sm"><span className="font-semibold text-teal-800">Medication:</span> {record.prescription}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Active Medications</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/patient/prescriptions')}>View All</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {prescriptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active medications.</div>
              ) : prescriptions.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
                  <p className="font-semibold text-teal-900">{item.drugName}</p>
                  <p className="text-sm text-muted-foreground">{item.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vitals History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-2">
                {[58, 74, 92, 66, 100].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t bg-teal-700/30" style={{ height: `${height}%` }} />
                ))}
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">Systolic BP trend</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Care Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from(new Set(records.map((record) => record.doctorName).filter(Boolean))).slice(0, 3).map((name) => (
                <div key={name} className="rounded-2xl bg-muted/50 p-3">
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-teal-700">Care Provider</p>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-2xl">Contact Team</Button>
            </CardContent>
          </Card>
        </div>
      </div>
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
