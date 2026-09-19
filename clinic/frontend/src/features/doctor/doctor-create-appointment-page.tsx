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

export function DoctorCreateAppointmentPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
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
        console.error("Failed to load data", err);
      }
    }
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId = user?.role === "DOCTOR" ? user.id : selectedDoctorId;
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
        status: "SCHEDULED",
        reasonForVisit: reason,
        notes,
      });
      window.location.href = "/doctor/appointments";
    } catch (err) {
      console.error("Failed to create appointment", err);
      alert(
        "Failed to schedule appointment. The selected doctor may not be available or there is a server error.",
      );
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
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
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
                <label className="text-sm font-medium">
                  Duration (minutes)
                </label>
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
              <Button
                type="submit"
                className="rounded-full px-8"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Scheduling..." : "Schedule Appointment"}
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
