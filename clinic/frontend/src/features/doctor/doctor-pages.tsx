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
  const [doctorStats, setDoctorStats] = useState<{
    todayAppointmentsCount: number;
    pendingNotesCount: number;
    prescriptionsSentCount: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        setStatsLoading(true);
        const data = await getDoctorStats();
        if (!mounted) return;
        setDoctorStats(data);
      } catch {
        if (!mounted) return;
        setDoctorStats({
          todayAppointmentsCount: appointments.length,
          pendingNotesCount: 0,
          prescriptionsSentCount: 0,
        });
      } finally {
        if (mounted) setStatsLoading(false);
      }
    }

    void fetchStats();

    return () => {
      mounted = false;
    };
  }, [appointments.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Dashboard"
        description="Track today's schedule, clinical work, and patient follow-up."
        actionLabel="New Record"
        actionHref="/doctor/records/new"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <CardDescription>
              Exact count from the doctor stats endpoint
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold text-teal-700">
              {statsLoading || !doctorStats
                ? "..."
                : doctorStats.todayAppointmentsCount}
            </div>
            <Calendar className="h-8 w-8 text-teal-700" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Pending Notes</CardTitle>
            <CardDescription>Records waiting for your review</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold text-sky-700">
              {statsLoading || !doctorStats
                ? "..."
                : doctorStats.pendingNotesCount}
            </div>
            <FileText className="h-8 w-8 text-sky-700" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Prescriptions Sent</CardTitle>
            <CardDescription>Exact doctor-issued orders</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold text-violet-700">
              {statsLoading || !doctorStats
                ? "..."
                : doctorStats.prescriptionsSentCount}
            </div>
            <PillBottle className="h-8 w-8 text-violet-700" />
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
                      onClick={() =>
                        router.push(`/doctor/patients/${item.patient.id}`)
                      }
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
