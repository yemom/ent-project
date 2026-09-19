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

export function DoctorAppointmentsPage() {
  const router = useRouter();
  const { appointments, isLoading, error } = useAppointments();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredAppointments = useMemo(() => {
    if (!query.trim()) return appointments;
    const q = query.toLowerCase();
    return appointments.filter((item) =>
      [item.patient.fullName, item.time, item.status, item.type].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [appointments, query]);

  const [labModal, setLabModal] = useState<{
    open: boolean;
    appointmentId?: string;
    patientId?: string;
    doctorId?: string;
  } | null>(null);

  useEffect(() => {
    const handler = () => {
      const data = (window as any).__labOrderModal;
      if (data && data.open) {
        setLabModal({
          open: true,
          appointmentId: data.appointmentId,
          patientId: data.patientId,
          doctorId: data.doctorId,
        });
      }
    };
    window.addEventListener("labOrderOpen", handler);
    return () => window.removeEventListener("labOrderOpen", handler);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Appointments"
        description="Manage incoming visits with clear status and conflict prevention."
        actionLabel="New Appointment"
        actionHref="/doctor/appointments/new"
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>
                  Real appointments and the next items in the queue
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
            <div className="flex gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                placeholder="Search appointments, patients, or status..."
              />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!isLoading && !error && filteredAppointments.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No appointments match your search.
              </p>
            )}

            {!isLoading && !error && filteredAppointments.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.patient.fullName}</TableCell>
                      <TableCell>{item.time}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {item.patient?.id && item.patient.id.length > 8 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                router.push(
                                  `/doctor/patients/${item.patient.id}`,
                                )
                              }
                            >
                              View
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.location.href = `/doctor/records/new?appointmentId=${item.id}`;
                            }}
                          >
                            Open Record
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              // open inline modal
                              (window as any).__labOrderModal = {
                                open: true,
                                appointmentId: item.id,
                                patientId: item.patient.id,
                                doctorId: item.doctor.id,
                              };
                              window.dispatchEvent(new Event("labOrderOpen"));
                            }}
                          >
                            Send to Lab
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {labModal?.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-2xl rounded bg-white p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Create Lab Order</h3>
                    <button
                      onClick={() => setLabModal(null)}
                      className="text-sm text-muted-foreground"
                    >
                      Close
                    </button>
                  </div>
                  <LabOrderForm
                    patientId={labModal.patientId ?? ""}
                    doctorId={labModal.doctorId ?? ""}
                    appointmentId={labModal.appointmentId}
                    onSuccess={(data) => {
                      toast.success("Lab order created successfully");
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Fast access to the most common tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button
                className="justify-start rounded-2xl"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/doctor/appointments/new";
                }}
              >
                Create new appointment
              </Button>
              <Button
                className="justify-start rounded-2xl"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/doctor/records/new";
                }}
              >
                Write medical record
              </Button>
              <Button
                className="justify-start rounded-2xl"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/doctor/patients";
                }}
              >
                Open patient directory
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <span>Total appointments</span>
                <Badge variant="outline">{appointments.length}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <span>Filtered view</span>
                <Badge variant="outline">{filteredAppointments.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
