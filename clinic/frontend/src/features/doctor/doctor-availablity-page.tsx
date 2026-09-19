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

export function DoctorAvailabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Schedule"
        description="Set office hours, slot buffers, and telehealth availability."
      />
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2 p-6">
          <div className="rounded-2xl bg-primary/10 p-4">
            Mon-Fri 09:00 - 17:00
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            Telehealth: Wednesdays 18:00 - 20:00
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
