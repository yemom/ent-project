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

export function DoctorOrderDrugPage() {
  const authUser = useAuthStore((state) => state.user);
  const [patientName, setPatientName] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !drugName || !dosage || !authUser?.id) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post("/prescription-orders", {
        doctorId: authUser.id,
        doctorName: authUser.fullName,
        patientName,
        drugName,
        dosage,
        instructions,
      });
      setSuccessMessage("Drug order sent to pharmacy successfully!");
      setPatientName("");
      setDrugName("");
      setDosage("");
      setInstructions("");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Failed to send drug order", err);
      alert("Failed to send drug order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Drug to Pharmacy"
        description="Send prescription orders directly to the pharmacy for fulfillment."
      />

      <Card>
        <CardHeader>
          <CardTitle>New Drug Order</CardTitle>
          <CardDescription>
            Fill in the details of the drug order you want to send to the
            pharmacy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
              {successMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Patient Name *</label>
              <Input
                type="text"
                placeholder="Enter patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Drug Name *</label>
              <Input
                type="text"
                placeholder="Enter drug name (e.g., Amoxicillin)"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Dosage *</label>
              <Input
                type="text"
                placeholder="Enter dosage (e.g., 500mg)"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions</label>
              <textarea
                placeholder="Enter any special instructions for the pharmacist..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[100px] w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl"
            >
              {isSubmitting ? "Sending..." : "Send Order to Pharmacy"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
