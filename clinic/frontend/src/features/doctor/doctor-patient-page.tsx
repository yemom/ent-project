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

export function DoctorPatientsPage() {
  const router = useRouter();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [patients, setPatients] = useState<
    Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      lastLogin?: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredPatients = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.toLowerCase();
    return patients.filter((patient) =>
      [patient.fullName, patient.email, patient.role].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [patients, query]);

  useEffect(() => {
    if (!isHydrated || !accessToken) return;

    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await listPatients({ size: 30 });
        setPatients(
          (data.content ?? []).map((p) => ({
            id: p.id,
            fullName: p.fullName,
            email: p.email,
            role: p.role,
            lastLogin: p.lastLogin,
          })),
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isHydrated, accessToken]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Directory"
        description="View and manage patient records and histories."
        actionLabel="Add Patient"
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Patient List</CardTitle>
              <CardDescription>
                Recently registered or active patients
              </CardDescription>
            </div>
            <div className="flex min-w-64 gap-3 rounded-2xl border border-input bg-background p-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search patients..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : filteredPatients.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No patients found.
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-semibold">{patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/doctor/patients/${patient.id}`)}
                >
                  View Details
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
