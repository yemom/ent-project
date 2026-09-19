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

export function DoctorSchedulePage() {
  const { appointments, isLoading } = useAppointments();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuthStore((s) => s.user);

  const requestItems = useMemo(() => {
    return appointments
      .filter(
        (item) => item.status === "PENDING" || item.status === "CONFIRMED",
      )
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        patientName: item.patient.fullName,
        note:
          item.status === "PENDING"
            ? `${item.type} request awaiting confirmation`
            : `${item.type} scheduled for ${item.time}`,
        received: item.time,
        status: item.status,
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
        status: "SCHEDULED",
        reasonForVisit: "Quick Add Appointment",
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
                    <p className="mt-2 text-sm font-medium">
                      {item.patient.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                    <Badge
                      className="mt-2"
                      variant={
                        item.status === "CONFIRMED" ? "success" : "warning"
                      }
                    >
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
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
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
                {isSubmitting ? "Creating..." : "Create Slot"}
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
                    onClick={() => {
                      window.location.href = `/doctor/records/new?appointmentId=${item.id}`;
                    }}
                    className="w-full rounded-2xl bg-white p-4 text-left shadow-sm transition hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{item.patientName}</p>
                      <span className="text-xs text-muted-foreground">
                        {item.received}
                      </span>
                    </div>
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      "{item.note}"
                    </p>
                    <Badge
                      className="mt-3"
                      variant={
                        item.status === "PENDING" ? "warning" : "outline"
                      }
                    >
                      {item.status}
                    </Badge>
                  </button>
                ))
              )}
              <Button
                variant="ghost"
                className="w-full text-teal-700"
                onClick={() => {
                  window.location.href = "/doctor/appointments";
                }}
              >
                View all requests
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
