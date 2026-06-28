"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  CheckCircle2,
  Shield,
  UserRoundPlus,
  BadgeCheck,
  Search,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/lib/constants";
import { createAppointment } from "@/services/api/appointments";
import { createDoctor, createPatient, inviteUser } from "@/services/api/admin";
import { listUsers, listPatients, listAvailableDoctors } from "@/services/api/users";
import { listDoctorAvailability } from "@/services/api/laboratory";
import {
  getDoctorAvailabilityLabel,
  isDoctorAvailableAtTime,
} from "@/lib/doctor-availability";
import { getFriendlyErrorMessage } from "@/lib/error-handler";
import { passwordFormRules } from "@/lib/password-policy";
import type { UserRole } from "@/types/api";
import type { ReactNode } from "react";

function ActionLayout({
  title,
  description,
  backHref,
  children,
}: Readonly<{
  title: string;
  description: string;
  backHref: string;
  children: ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <Link
          href={backHref as never}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      {children}
    </div>
  );
}

function StatusBanner({ status, isError }: Readonly<{ status: string | null; isError?: boolean }>) {
  if (!status) return null;

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="h-4 w-4" />
        {status}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4" />
      {status}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: Readonly<{ label: string; error?: string; children: ReactNode }>) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      {children}
      {error && <span className="text-xs text-red-500 font-medium block">{error}</span>}
    </label>
  );
}

export function InviteUserPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [search, setSearch] = useState("");
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      status: string;
    }>
  >([]);
  const form = useForm<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    specialization: string;
    licenseNumber: string;
    role: UserRole;
  }>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      specialization: "",
      licenseNumber: "",
      role: "PATIENT",
    },
  });

  useEffect(() => {
    async function fetchMembers() {
      try {
        const data = await listUsers({ size: 8 });
        setTeamMembers(
          (data.content ?? []).map((item) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
            role: item.role,
            status: item.status,
          })),
        );
      } catch {
        setTeamMembers([]);
      }
    }

    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return teamMembers;
    const q = search.toLowerCase();
    return teamMembers.filter((member) =>
      [member.fullName, member.email, member.role].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [search, teamMembers]);

  return (
    <ActionLayout
      title="Add New Staff Member"
      description="Configure account settings, clinical credentials, and access levels for a new provider or administrator."
      backHref={ROUTES.adminUsers}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRoundPlus className="h-5 w-5" /> Personal Information
            </CardTitle>
            <CardDescription>
              Capture the core identity and contact details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBanner status={status} isError={isError} />
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                setStatus(null);
                setIsError(false);
                const fullName =
                  `${values.firstName} ${values.lastName}`.trim();

                try {
                  if (values.role === "DOCTOR") {
                    // specialization and licenseNumber are required by the backend
                    if (!values.specialization || !values.specialization.trim()) {
                      setIsError(true);
                      setStatus("Specialization is required for a Doctor account.");
                      return;
                    }
                    if (!values.licenseNumber || !values.licenseNumber.trim()) {
                      setIsError(true);
                      setStatus("Medical license number is required for a Doctor account.");
                      return;
                    }
                    await createDoctor({
                      fullName,
                      email: values.email,
                      password: values.password,
                      phone: values.phone || undefined,
                      specialization: values.specialization.trim(),
                      licenseNumber: values.licenseNumber.trim(),
                    });
                    setStatus("Doctor created successfully.");
                    setTimeout(() => router.push(ROUTES.adminDoctors), 700);
                    return;
                  }

                  if (values.role === "PATIENT") {
                    await createPatient({
                      fullName,
                      email: values.email,
                      password: values.password,
                      phone: values.phone || undefined,
                    });
                    setStatus("Patient created successfully.");
                    setTimeout(() => router.push(ROUTES.adminPatients), 700);
                    return;
                  }

                  if (values.role === "PHARMACIST") {
                    await inviteUser({
                      fullName,
                      email: values.email,
                      password: values.password,
                      phone: values.phone || undefined,
                      role: "PHARMACIST",
                    });
                    setStatus("Pharmacist created successfully.");
                    setTimeout(() => router.push(ROUTES.adminPharmacy), 700);
                    return;
                  }

                  if (values.role === "LABORATORY") {
                    await inviteUser({
                      fullName,
                      email: values.email,
                      password: values.password,
                      phone: values.phone || undefined,
                      role: "LABORATORY",
                    });
                    setStatus("Laboratory user created successfully.");
                    setTimeout(() => router.push(ROUTES.adminLaboratories), 700);
                    return;
                  }

                  setIsError(true);
                  setStatus(
                    "Admin accounts are not supported from this screen yet. Choose Doctor, Patient, Pharmacist, or Laboratory.",
                  );
                } catch (err) {
                  setIsError(true);
                  setStatus(
                    getFriendlyErrorMessage(err, "Could not create the user. Please check the details and try again."),
                  );
                }
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="First name">
                  <Input
                    {...form.register("firstName", { required: true })}
                    placeholder="Elena"
                    className="h-11 rounded-xl"
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    {...form.register("lastName", { required: true })}
                    placeholder="Vance"
                    className="h-11 rounded-xl"
                  />
                </Field>
              </div>
              <Field label="Work email address">
                <Input
                  {...form.register("email", { required: true })}
                  type="email"
                  placeholder="e.vance@clinic.elhealth"
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="Temporary password">
                <Input
                  {...form.register("password", passwordFormRules)}
                  type="password"
                  placeholder="e.g. Clinic123!"
                  className="h-11 rounded-xl"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Phone number">
                  <Input
                    {...form.register("phone")}
                    placeholder="+1 (555) 000-0000"
                    className="h-11 rounded-xl"
                  />
                </Field>
                <Field label="Preferred language">
                  <select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                    <option>English (US)</option>
                    <option>Spanish (US)</option>
                    <option>French</option>
                  </select>
                </Field>
              </div>

              <Card className="border-muted/60 bg-muted/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4" /> Professional Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="NPI Number">
                      <Input
                        placeholder="10-digit NPI"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Medical license number">
                      <Input
                        {...form.register("licenseNumber")}
                        placeholder="ST-12345678"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                  </div>
                  <Field label="Primary specialty">
                    <Input
                      {...form.register("specialization")}
                      placeholder="Cardiology"
                      className="h-11 rounded-xl"
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card className="border-muted/60 bg-muted/20">
                <CardHeader>
                  <CardTitle className="text-base">Role Assignment</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      value: "DOCTOR",
                      label: "Doctor",
                      description:
                        "Full clinical access, prescribing authority, and diagnosis.",
                    },
                    {
                      value: "PATIENT",
                      label: "Patient",
                      description:
                        "Portal access for visits, records, and prescriptions.",
                    },
                    {
                      value: "PHARMACIST",
                      label: "Pharmacist",
                      description:
                        "Pharmacy access, order fulfillment, and inventory.",
                    },
                    {
                      value: "LABORATORY",
                      label: "Laboratory",
                      description:
                        "Access to lab orders, results entry, and processing.",
                    },
                    {
                      value: "ADMIN",
                      label: "Admin",
                      description:
                        "Billing access, scheduling, and system configuration.",
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        form.setValue("role", item.value as UserRole)
                      }
                      disabled={item.value === "ADMIN"}
                      className={`rounded-2xl border p-4 text-left transition ${form.watch("role") === item.value ? "border-primary bg-primary/5" : "border-border bg-background"} ${item.value === "ADMIN" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <p className="font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  Save Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Profile Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
                Upload photo
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a professional high-resolution headshot for the patient
                portal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" /> Security Tier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-medium">HIPAA Compliance</p>
                  <p className="text-xs text-muted-foreground">
                    Strict PHI visibility
                  </p>
                </div>
                <Badge variant="success">On</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-medium">System Superuser</p>
                  <p className="text-xs text-muted-foreground">
                    Manage global settings
                  </p>
                </div>
                <Badge variant="outline">Off</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4" /> Team Lookup
              </CardTitle>
              <CardDescription>
                Search the live roster before assigning a new member.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members..."
                className="h-11 rounded-xl"
              />
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="rounded-2xl bg-muted/50 p-3">
                    <p className="font-medium">{member.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">{member.role}</Badge>
                      <Badge
                        variant={
                          member.status === "ACTIVE" ? "success" : "secondary"
                        }
                      >
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ActionLayout>
  );
}

export function AddDoctorPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      specialization: "",
      licenseNumber: "",
      yearsOfExperience: "",
      qualifications: "",
      consultationFee: "",
      bio: "",
    },
  });

  const [doctorError, setDoctorError] = useState<string | null>(null);

  const doctorMutation = useMutation({
    mutationFn: createDoctor,
    onSuccess: () => {
      setStatus("Doctor created successfully.");
      setDoctorError(null);
      setTimeout(() => router.push(ROUTES.adminDoctors), 700);
    },
    onError: (err) => {
      setDoctorError(
        getFriendlyErrorMessage(err, "Could not create doctor. Please check the form details and try again."),
      );
    },
  });

  return (
    <ActionLayout
      title="Add Doctor"
      description="Register a new provider and set their credential details."
      backHref={ROUTES.adminDoctors}
    >
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Add provider profile</CardTitle>
          <CardDescription>
            Collect the core onboarding details used by the doctor registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusBanner status={doctorError} isError />
          <StatusBanner status={doctorError ? null : status} />
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              doctorMutation.mutate({
                ...values,
                yearsOfExperience: values.yearsOfExperience
                  ? Number(values.yearsOfExperience)
                  : undefined,
                // Convert to number so Jackson maps it to BigDecimal correctly
                consultationFee: values.consultationFee
                  ? Number(values.consultationFee)
                  : undefined,
              }),
            )}
          >
            <Field label="Full name">
              <Input
                {...form.register("fullName")}
                className="h-11 rounded-xl"
                placeholder="Dr. Sara Ahmed"
              />
            </Field>
            <Field label="Email">
              <Input
                {...form.register("email")}
                type="email"
                className="h-11 rounded-xl"
                placeholder="sara@clinic.com"
              />
            </Field>
            <Field label="Password">
              <Input
                {...form.register("password", passwordFormRules)}
                type="password"
                className="h-11 rounded-xl"
                placeholder="e.g. Clinic123!"
              />
            </Field>
            <Field label="Phone">
              <Input
                {...form.register("phone")}
                className="h-11 rounded-xl"
                placeholder="+1 555 0100"
              />
            </Field>
            <Field label="Specialization">
              <Input
                {...form.register("specialization")}
                className="h-11 rounded-xl"
                placeholder="Cardiology"
              />
            </Field>
            <Field label="License number">
              <Input
                {...form.register("licenseNumber")}
                className="h-11 rounded-xl"
                placeholder="LIC-12345"
              />
            </Field>
            <Field label="Years of experience">
              <Input
                {...form.register("yearsOfExperience")}
                type="number"
                min="0"
                className="h-11 rounded-xl"
                placeholder="8"
              />
            </Field>
            <Field label="Consultation fee">
              <Input
                {...form.register("consultationFee")}
                className="h-11 rounded-xl"
                placeholder="150"
              />
            </Field>
            <Field label="Qualifications">
              <Input
                {...form.register("qualifications")}
                className="h-11 rounded-xl md:col-span-2"
                placeholder="MBBS, MD"
              />
            </Field>
            <Field label="Bio">
              <Input
                {...form.register("bio")}
                className="h-11 rounded-xl md:col-span-2"
                placeholder="Short professional summary"
              />
            </Field>
            <Button
              type="submit"
              className="md:col-span-2 rounded-2xl"
              disabled={doctorMutation.isPending}
            >
              {doctorMutation.isPending ? "Saving..." : "Add doctor"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </ActionLayout>
  );
}

export function ImportPatientsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      medicalHistory: "",
      bloodType: "",
      allergies: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
  });

  const [isPatientError, setIsPatientError] = useState(false);

  const patientMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      setIsPatientError(false);
      setStatus("Patient imported successfully.");
      setTimeout(() => router.push(ROUTES.adminPatients), 700);
    },
    onError: (err) => {
      setIsPatientError(true);
      setStatus(
        getFriendlyErrorMessage(
          err,
          "Could not import patient. Please check the inputs.",
        ),
      );
    },
  });

  return (
    <ActionLayout
      title="Import Patients"
      description="Register patient records so care teams can begin tracking them immediately."
      backHref={ROUTES.adminPatients}
    >
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Patient import</CardTitle>
          <CardDescription>
            Capture the core demographics and emergency contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusBanner status={status} isError={isPatientError} />
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((values) => {
              const validGenders = ['MALE', 'FEMALE', 'OTHER'] as const;
              const rawGender = values.gender?.toUpperCase().trim() as 'MALE' | 'FEMALE' | 'OTHER' | '';
              const gender = validGenders.includes(rawGender as 'MALE' | 'FEMALE' | 'OTHER')
                ? (rawGender as 'MALE' | 'FEMALE' | 'OTHER')
                : undefined;
              patientMutation.mutate({
                ...values,
                phone: values.phone || undefined,
                dateOfBirth: values.dateOfBirth || undefined,
                gender,
                medicalHistory: values.medicalHistory || undefined,
                bloodType: values.bloodType || undefined,
                allergies: values.allergies || undefined,
                emergencyContactName: values.emergencyContactName || undefined,
                emergencyContactPhone: values.emergencyContactPhone || undefined,
              });
            })}
          >
            <Field label="Full name">
              <Input
                {...form.register("fullName")}
                className="h-11 rounded-xl"
                placeholder="Amina Yusuf"
              />
            </Field>
            <Field label="Email">
              <Input
                {...form.register("email")}
                type="email"
                className="h-11 rounded-xl"
                placeholder="amina@clinic.com"
              />
            </Field>
            <Field label="Password">
              <Input
                {...form.register("password", passwordFormRules)}
                type="password"
                className="h-11 rounded-xl"
                placeholder="e.g. Clinic123!"
              />
            </Field>
            <Field label="Phone">
              <Input
                {...form.register("phone")}
                className="h-11 rounded-xl"
                placeholder="+1 555 0200"
              />
            </Field>
            <Field label="Date of birth">
              <Input
                {...form.register("dateOfBirth")}
                type="date"
                className="h-11 rounded-xl"
              />
            </Field>
            <Field label="Gender">
              <select
                {...form.register("gender")}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Select gender...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Blood type">
              <Input
                {...form.register("bloodType")}
                className="h-11 rounded-xl"
                placeholder="O+"
              />
            </Field>
            <Field label="Allergies">
              <Input
                {...form.register("allergies")}
                className="h-11 rounded-xl"
                placeholder="Penicillin"
              />
            </Field>
            <Field label="Emergency contact name">
              <Input
                {...form.register("emergencyContactName")}
                className="h-11 rounded-xl"
                placeholder="Fatima Yusuf"
              />
            </Field>
            <Field label="Emergency contact phone">
              <Input
                {...form.register("emergencyContactPhone")}
                className="h-11 rounded-xl"
                placeholder="+1 555 0300"
              />
            </Field>
            <Field label="Medical history">
              <Input
                {...form.register("medicalHistory")}
                className="h-11 rounded-xl md:col-span-2"
                placeholder="Hypertension, asthma"
              />
            </Field>
            <Button
              type="submit"
              className="md:col-span-2 rounded-2xl"
              disabled={patientMutation.isPending}
            >
              {patientMutation.isPending ? "Importing..." : "Import patients"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </ActionLayout>
  );
}

export function CreateAppointmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    fullName: string;
    bloodType: string;
    age: string;
  } | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [appointmentType, setAppointmentType] = useState("Consultation");
  const [department, setDepartment] = useState("Neurology");
  const [hasConflict, setHasConflict] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const form = useForm({
    defaultValues: {
      patientId: "",
      doctorId: "",
      appointmentDate: "",
      appointmentTime: "09:30",
      duration: "30",
      reasonForVisit: "",
    },
  });

  const appointmentDate = form.watch("appointmentDate");
  const appointmentTime = form.watch("appointmentTime");

  useEffect(() => {
    async function fetch() {
      try {
        const [patientData, doctorData, scheduleData] = await Promise.all([
          listPatients({ size: 50 }),
          listAvailableDoctors({ size: 100 }),
          listDoctorAvailability({ size: 200 }),
        ]);
        setPatients(patientData.content || []);
        setDoctors(doctorData.content || []);
        setSchedules(
          (scheduleData.content || []).map((slot: any) => ({
            doctorId: slot.doctorId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: slot.isAvailable,
          })),
        );
      } catch (err) {
        setStatus(
          getFriendlyErrorMessage(
            err,
            "We could not load the search data right now. Please try again.",
          ),
        );
      }
    }
    fetch();
  }, []);

  const bookableDoctors = useMemo(() => {
    return doctors.filter((doctor) =>
      isDoctorAvailableAtTime(
        doctor.id,
        schedules,
        appointmentDate,
        appointmentTime,
      ),
    );
  }, [doctors, schedules, appointmentDate, appointmentTime]);

  useEffect(() => {
    const selectedDoctorId = form.getValues("doctorId");
    if (
      selectedDoctorId &&
      !bookableDoctors.some((doctor) => doctor.id === selectedDoctorId)
    ) {
      form.setValue("doctorId", "");
    }
  }, [bookableDoctors, form]);

  const filteredPatients = patientSearch
    ? patients.filter((p) =>
        p.fullName.toLowerCase().includes(patientSearch.toLowerCase()),
      )
    : [];

  const appointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      setStatus("Appointment created successfully.");
      setTimeout(() => router.push(ROUTES.adminAppointments), 700);
    },
    onError: (err) => {
      setStatus(
        getFriendlyErrorMessage(
          err,
          "We could not create the appointment right now. Please review the details and try again.",
        ),
      );
    },
  });

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient({
      id: patient.id,
      fullName: patient.fullName,
      bloodType: patient.bloodType || "O+",
      age: "34",
    });
    form.setValue("patientId", patient.id);
    setPatientSearch("");
  };

  const handleSubmit = (values: any) => {
    if (!selectedPatient || !values.doctorId) {
      setStatus(
        "Please choose a patient and a doctor before creating the appointment.",
      );
      return;
    }

    if (
      !isDoctorAvailableAtTime(
        values.doctorId,
        schedules,
        values.appointmentDate,
        values.appointmentTime,
      )
    ) {
      setStatus(
        "The selected doctor is not available at that date and time. Please choose another doctor or time.",
      );
      return;
    }

    const dateTime = `${values.appointmentDate}T${values.appointmentTime}:00`;

    const payload = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      appointmentDate: dateTime,
      duration: Number(values.duration),
      reasonForVisit: values.reasonForVisit || appointmentType,
      notes: "",
    };

    console.log("Appointment Payload:", payload);

    appointmentMutation.mutate(payload);
  };

  return (
    <ActionLayout
      title="New Patient Appointment"
      description="Fill in the details to schedule a clinical visit."
      backHref={ROUTES.adminAppointments}
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>New Patient Appointment</CardTitle>
              <CardDescription>
                Fill in the details to schedule a clinical visit.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <StatusBanner status={status} />

          {/* Patient Information */}
          <div>
            <label className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
              Patient Information
            </label>
            <div className="mt-3 space-y-3">
              <div className="relative">
                <div className="flex gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                  />
                </div>
                {patientSearch && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-2xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePatientSelect(p)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-0"
                      >
                        <p className="font-medium text-sm">{p.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {p.id}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedPatient && (
                <div className="flex gap-3 rounded-2xl border border-border bg-muted/50 p-4">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-teal-700">
                      {selectedPatient.fullName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {selectedPatient.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: CC-9982 • Age: {selectedPatient.age} •{" "}
                      {selectedPatient.bloodType} Blood Type
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Department & Appointment Type */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-3 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-medium"
              >
                <option>Neurology</option>
                <option>Cardiology</option>
                <option>Dermatology</option>
                <option>General Practice</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
                Appointment Type
              </label>
              <div className="mt-3 flex gap-2">
                {["Consultation", "Follow-up", "Surgery"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setAppointmentType(type)}
                    className={`px-4 py-2 rounded-2xl font-medium text-sm transition ${
                      appointmentType === type
                        ? "bg-teal-700 text-white"
                        : "bg-muted text-slate-700 hover:bg-muted/80"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div>
            <label className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
              Scheduling
            </label>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="flex gap-2">
                <input
                  {...form.register("appointmentDate")}
                  type="date"
                  className="flex-1 h-11 rounded-2xl border border-border bg-white px-4 text-sm"
                />
                <input
                  {...form.register("appointmentTime")}
                  type="time"
                  className="w-32 h-11 rounded-2xl border border-border bg-white px-4 text-sm"
                />
              </div>
            </div>

            {/* Scheduling Conflict */}
            {hasConflict && (
              <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 text-sm">
                      Scheduling Conflict
                    </p>
                    <p className="text-red-800 text-sm mt-1">
                      Dr. Smith has a "Surgery" block starting at 10:00 AM on
                      Oct 24. This consultation might overlap.
                    </p>
                    <button className="text-red-700 text-sm font-medium mt-2 hover:underline">
                      SEE AVAILABLE SLOTS
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Doctor Availability */}
          <div>
            <label className="text-sm font-semibold text-slate-900 uppercase tracking-tight">
              Doctor Availability
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Doctors are available by default until a custom schedule is added on the Doctor Availability page.
            </p>
            <div className="mt-3 space-y-2">
              {bookableDoctors.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No doctors are available for the selected date and time.
                </div>
              ) : (
                bookableDoctors.map((doctor) => (
                  <label
                    key={doctor.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 cursor-pointer hover:bg-teal-50/50 transition has-[:checked]:border-teal-300 has-[:checked]:bg-teal-50/40"
                  >
                    <input
                      type="radio"
                      name="doctor"
                      value={doctor.id}
                      checked={form.watch("doctorId") === doctor.id}
                      onChange={(e) => form.setValue("doctorId", e.target.value)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{doctor.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {doctor.specialization || "General Practice"} •{" "}
                        {getDoctorAvailabilityLabel(
                          doctor.id,
                          schedules,
                          appointmentDate,
                          appointmentTime,
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-teal-50 text-teal-700 border-teal-200"
                    >
                      AVAILABLE
                    </Badge>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => router.push(ROUTES.adminAppointments)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white"
              onClick={form.handleSubmit(handleSubmit)}
              disabled={appointmentMutation.isPending}
            >
              {appointmentMutation.isPending
                ? "Creating..."
                : "Confirm Appointment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </ActionLayout>
  );
}
