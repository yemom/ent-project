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
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { LabOrderForm } from "@/features/laboratory/components/lab-order-form";
import { createAppointment } from "@/services/api/appointments";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMedicalRecord,
  listMedicalRecords,
  searchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "@/services/api/medical-records";
import { getPatient, listPatients, updatePatient } from "@/services/api/users";
import { useLabOrders } from "@/features/laboratory/hooks/use-lab-orders";
import { LabOrderList } from "@/features/laboratory/components/lab-order-list";
import {
  listPrescriptionOrdersByDoctor,
  listPrescriptionOrders,
  updatePrescriptionOrder,
  deletePrescriptionOrder,
} from "@/features/prescriptions";
import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/store/auth-store";
import { StatusAlert, type StatusType } from "@/components/shared/status-alert";
import { getFriendlyErrorMessage } from "@/lib/error-handler";
import { getDoctorStats } from "@/services/api/doctor";
import { labOrdersService } from "@/features/laboratory/services/lab-orders.service";
import { labResultsService } from "@/features/laboratory/services/lab-results.service";
import { LAB_TEST_TYPES, LAB_URGENCY } from "@/lib/constants";

export function DoctorPatientDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<{
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
  } | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authReady = isHydrated && Boolean(accessToken);
  const pageLoading = !authReady || isLoading;
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    diagnosis: "",
    treatment: "",
    prescription: "",
    notes: "",
  });
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    bloodType: "",
    allergies: "",
    medicalHistory: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const startEditingProfile = () => {
    if (!patient) return;
    setProfileForm({
      bloodType: patient.bloodType || "",
      allergies: patient.allergies || "",
      medicalHistory: patient.medicalHistory || "",
      phone: patient.phone || "",
      dateOfBirth: patient.dateOfBirth || "",
      gender: patient.gender || "",
      emergencyContactName: patient.emergencyContactName || "",
      emergencyContactPhone: patient.emergencyContactPhone || "",
    });
    setIsEditingProfile(true);
    setStatus(null);
  };

  const handleSaveProfile = async () => {
    try {
      const updated = await updatePatient(id, profileForm);
      if (patient) setPatient({ ...patient, ...updated });
      setIsEditingProfile(false);
      setStatus("success");
      setStatusMessage("Patient profile updated successfully!");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Failed to update patient profile"),
      );
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (!accessToken || !id) {
      setIsLoading(false);
      setPatient(null);
      setRecords([]);
      setFetchError("Please sign in again to view patient details.");
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        setFetchError("");

        const [found, recordsData] = await Promise.all([
          getPatient(id),
          searchMedicalRecords({ patientId: id, size: 50 }).catch(() => ({
            content: [],
          })),
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
          active: found.active,
        });
        setRecords(recordsData.content ?? []);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching patient details", err);
        setPatient(null);
        setRecords([]);
        setFetchError(
          getFriendlyErrorMessage(
            err,
            "Could not load patient details. Please try again.",
          ),
        );
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
      diagnosis: record.diagnosis || "",
      treatment: record.treatment || "",
      prescription: record.prescription || "",
      notes: record.notes || "",
    });
    setStatus(null);
  };

  const handleSaveEdit = async () => {
    if (!editingRecordId) return;
    try {
      await updateMedicalRecord(editingRecordId, editForm);
      setRecords(
        records.map((r) =>
          r.id === editingRecordId ? { ...r, ...editForm } : r,
        ),
      );
      setEditingRecordId(null);
      setStatus("success");
      setStatusMessage("Medical record updated successfully!");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Failed to update medical record"),
      );
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("Delete this medical record? This action cannot be undone."))
      return;
    try {
      await deleteMedicalRecord(recordId);
      setRecords(records.filter((r) => r.id !== recordId));
      setStatus("success");
      setStatusMessage("Medical record deleted successfully!");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Failed to delete medical record"),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Details"
        description="Detailed patient information and medical history."
        actionLabel="Back to Directory"
        actionHref={
          user?.role === "ADMIN" ? "/admin/patients" : "/doctor/patients"
        }
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
          onDismiss={() => setFetchError("")}
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
                {patient.fullName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-4xl font-bold text-slate-950">
                    {patient.fullName}
                  </h2>
                  <Badge
                    variant={patient.active === false ? "secondary" : "success"}
                  >
                    {patient.active === false ? "Inactive" : "Active"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">ID: {patient.id.slice(0, 8)}</Badge>
                  {patient.dateOfBirth && (
                    <Badge variant="outline">
                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </Badge>
                  )}
                  {patient.gender && (
                    <Badge variant="secondary">{patient.gender}</Badge>
                  )}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Blood Type
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-teal-800">
                      {patient.bloodType || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Last Login
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {patient.lastLogin
                        ? new Date(patient.lastLogin).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                      Allergies
                    </p>
                    <p className="mt-2 text-xl font-semibold text-red-800">
                      {patient.allergies || "None listed"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Risk Level
                    </p>
                    <p className="mt-2 text-xl font-semibold text-amber-700">
                      {patient.allergies ? "Moderate" : "Standard"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 lg:flex-col">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={startEditingProfile}
                >
                  Edit Profile
                </Button>
                <Button
                  className="rounded-2xl bg-teal-700 hover:bg-teal-800"
                  onClick={() => {
                    window.print();
                  }}
                >
                  Export Records
                </Button>
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
              <div className="text-sm text-muted-foreground">
                Patient not found.
              </div>
            ) : isEditingProfile ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blood Type</label>
                    <select
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={profileForm.bloodType}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          bloodType: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Blood Type</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <select
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={profileForm.gender}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          gender: e.target.value,
                        })
                      }
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
                    value={
                      profileForm.dateOfBirth
                        ? profileForm.dateOfBirth.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        dateOfBirth: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Allergies</label>
                  <Input
                    value={profileForm.allergies}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        allergies: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Emergency Name
                    </label>
                    <Input
                      value={profileForm.emergencyContactName}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          emergencyContactName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Emergency Phone
                    </label>
                    <Input
                      value={profileForm.emergencyContactPhone}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          emergencyContactPhone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Medical History</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={profileForm.medicalHistory}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        medicalHistory: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Full Name
                  </p>
                  <p className="text-lg font-medium">{patient.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Email
                  </p>
                  <p className="text-lg">{patient.email}</p>
                </div>
                {patient.phone && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Phone
                    </p>
                    <p className="text-lg">{patient.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    System Role
                  </p>
                  <Badge variant="outline">{patient.role}</Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Last Login
                  </p>
                  <p className="text-lg">
                    {patient.lastLogin
                      ? new Date(patient.lastLogin).toLocaleString()
                      : "Never logged in"}
                  </p>
                </div>
                {(patient.emergencyContactName ||
                  patient.emergencyContactPhone) && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Emergency Contact
                    </p>
                    <p className="text-lg">
                      {patient.emergencyContactName || "N/A"}{" "}
                      {patient.emergencyContactPhone
                        ? `• ${patient.emergencyContactPhone}`
                        : ""}
                    </p>
                  </div>
                )}
                {patient.medicalHistory && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Medical History
                    </p>
                    <p className="text-base text-muted-foreground">
                      {patient.medicalHistory}
                    </p>
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
              <div className="text-sm text-muted-foreground">
                No clinical records found.
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-teal-700">
                        {new Date(
                          record.recordDate || record.visitDate,
                        ).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            router.push(
                              `/${user?.role === "ADMIN" ? "admin" : "doctor"}/records/${record.id}`,
                            );
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(record)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {editingRecordId === record.id ? (
                      <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                        <Input
                          value={editForm.diagnosis}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              diagnosis: event.target.value,
                            })
                          }
                          placeholder="Diagnosis"
                        />
                        <Input
                          value={editForm.treatment}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              treatment: event.target.value,
                            })
                          }
                          placeholder="Treatment"
                        />
                        <Input
                          value={editForm.prescription}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              prescription: event.target.value,
                            })
                          }
                          placeholder="Prescription"
                        />
                        <textarea
                          value={editForm.notes}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              notes: event.target.value,
                            })
                          }
                          placeholder="Notes"
                          className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingRecordId(null)}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium mt-1">
                          Diagnosis: {record.diagnosis}
                        </p>
                        {record.treatment && (
                          <p className="text-sm text-muted-foreground">
                            Treatment: {record.treatment}
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-sm text-muted-foreground">
                            Notes: {record.notes}
                          </p>
                        )}
                        {record.prescription && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                            <p className="text-xs font-bold text-amber-800 uppercase">
                              Prescription
                            </p>
                            <p className="text-sm text-amber-900">
                              {record.prescription}
                            </p>
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
