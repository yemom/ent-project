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

export function DoctorCreateRecordPage() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? undefined;
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [prescription, setPrescription] = useState("");
  const [notes, setNotes] = useState("");
  const [medicalRecordType, setMedicalRecordType] = useState("CONSULTATION");
  const [confidential, setConfidential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchData() {
      try {
        const [patientsData, doctorsData] = await Promise.all([
          listPatients({ size: 100 }),
          user?.role === "ADMIN"
            ? apiClient.get("/doctors?size=100")
            : Promise.resolve({ data: { content: [] } }),
        ]);
        setPatients(patientsData.content ?? []);
        if (user?.role === "ADMIN") {
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
    const docId = user?.role === "DOCTOR" ? user.id : selectedDoctorId;
    if (!selectedPatientId || !user || !docId) {
      alert("Please select both patient and doctor.");
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
        recordDate: new Date().toISOString().split("T")[0],
        medicalRecordType,
        confidential,
        followUpRequired: false,
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
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </div>
              {user?.role === "ADMIN" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Doctor</label>
                  <select
                    className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
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
                <label className="text-sm font-medium">
                  Confidential Record
                </label>
                <select
                  className="w-full h-11 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                  value={confidential ? "true" : "false"}
                  onChange={(e) => setConfidential(e.target.value === "true")}
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
              <Button
                type="submit"
                className="rounded-full px-8"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Clinical Record"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
