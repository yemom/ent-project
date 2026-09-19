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
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const basePath = user?.role === "ADMIN" ? "/admin" : "/doctor";
  const patientId = record?.patient?.id;
  const backHref = patientId
    ? `${basePath}/patients/${patientId}`
    : `${basePath}/patients`;

  useEffect(() => {
    async function fetchRecord() {
      try {
        setIsLoading(true);
        const data = await getMedicalRecord(id);
        setRecord(data);
      } catch (err) {
        console.error("Error fetching medical record", err);
        setStatus("error");
        setStatusMessage(
          getFriendlyErrorMessage(err, "Failed to load medical record"),
        );
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
          <CardContent className="p-6 text-sm text-muted-foreground">
            Medical record not found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{record.diagnosis}</CardTitle>
              <CardDescription>
                {visitDate
                  ? new Date(visitDate).toLocaleString()
                  : "Date unavailable"}
                {record.medicalRecordType
                  ? ` • ${record.medicalRecordType}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {record.treatment && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Treatment
                  </p>
                  <p className="mt-1 text-base">{record.treatment}</p>
                </div>
              )}
              {record.prescription && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-800">
                    Prescription
                  </p>
                  <p className="mt-2 text-sm text-amber-900">
                    {record.prescription}
                  </p>
                </div>
              )}
              {record.testResults && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Test Results
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-base">
                    {record.testResults}
                  </p>
                </div>
              )}
              {record.vitalSigns && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Vital Signs
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-base">
                    {record.vitalSigns}
                  </p>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Clinical Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-muted-foreground">
                    {record.notes}
                  </p>
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
                  <p className="mt-1 text-base">
                    {record.patient?.fullName || "Unknown"}
                  </p>
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
                  <p className="font-semibold text-muted-foreground">
                    Attending Doctor
                  </p>
                  <p className="mt-1 text-base">
                    {record.doctor?.fullName || "Unknown"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.confidential && (
                    <Badge variant="warning">Confidential</Badge>
                  )}
                  {record.followUpRequired && (
                    <Badge variant="outline">Follow-up required</Badge>
                  )}
                  {record.followUpDate && (
                    <Badge variant="secondary">
                      Follow-up:{" "}
                      {new Date(record.followUpDate).toLocaleDateString()}
                    </Badge>
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
