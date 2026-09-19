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

export function DoctorRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<
    Array<{
      id: string;
      diagnosis: string;
      status: string;
      visitDate: string;
      patientName: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listMedicalRecords({ size: 30 });
        setRecords(
          (data.content ?? []).map((r) => ({
            id: r.id,
            diagnosis: r.diagnosis,
            status: (r.status || r.medicalRecordType || "SIGNED") as string,
            visitDate: (r.recordDate ||
              r.visitDate ||
              new Date().toISOString()) as string,
            patientName: r.patient?.fullName || r.patientName,
          })),
        );
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
          <CardDescription>
            Recent medical encounters and summaries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : records.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No records found.
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-semibold">{record.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {record.diagnosis}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(record.visitDate).toLocaleDateString()}
                  </p>
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
