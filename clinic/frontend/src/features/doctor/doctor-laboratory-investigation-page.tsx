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

export function DoctorLaboratoryInvestigationsPage() {
  const authUser = useAuthStore((state) => state.user);
  const [patients, setPatients] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    patientId: string;
    tests: string[];
    urgency: (typeof LAB_URGENCY)[number];
    clinicalNotes: string;
  }>({
    patientId: "",
    tests: [] as string[],
    urgency: "routine",
    clinicalNotes: "",
  });

  const labTestTypes = [
    "Blood Test",
    "Urinalysis",
    "Complete Blood Count (CBC)",
    "Blood Chemistry",
    "Liver Function Test",
    "Kidney Function Test",
    "Thyroid Function Test",
    "Lipid Profile",
    "Blood Glucose Test",
    "Coagulation Test",
    "Pregnancy Test",
    "COVID-19 Test",
    "Malaria Test",
    "Blood Culture",
    "Bacterial Culture",
  ];

  // Load patients and lab orders on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch patients
        const patientsRes = await listPatients({ size: 100 });
        setPatients(patientsRes.content || []);

        // Fetch lab orders for this doctor
        if (authUser?.id) {
          try {
            const ordersRes = await labOrdersService.list({
              doctorId: authUser.id,
              size: 50,
            });
            const orders: Array<{ id: string }> = ordersRes?.content || [];
            setLabOrders(orders);

            // Fetch results for each order in parallel
            const resultsMap = new Map<string, any>();
            const resultPromises = orders.map((order) =>
              labResultsService
                .getByLabOrderId(order.id)
                .then((result) => {
                  if (result) {
                    resultsMap.set(order.id, result);
                  }
                })
                .catch(() => {
                  // Result might not exist yet - silent fail
                }),
            );

            await Promise.all(resultPromises);
            setLabResults(resultsMap);
          } catch (err) {
            console.error("Failed to load lab orders:", err);
            setLabOrders([]);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setStatus("error");
        setStatusMessage(
          getFriendlyErrorMessage(err, "Could not load laboratory data"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authUser?.id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientId || formData.tests.length === 0) {
      setStatus("error");
      setStatusMessage("Please select a patient and at least one test");
      return;
    }

    if (!authUser?.id) {
      setStatus("error");
      setStatusMessage(
        "Your doctor profile is not available yet. Please refresh and try again.",
      );
      return;
    }

    try {
      setIsCreating(true);
      const orderData = {
        patientId: formData.patientId,
        doctorId: authUser.id,
        tests: formData.tests,
        urgency: formData.urgency,
        clinicalNotes: formData.clinicalNotes,
      };
      console.log("here");

      await labOrdersService.create(orderData);
      console.log("Order created:", orderData);

      setStatus("success");
      setStatusMessage("Laboratory order created successfully!");
      setShowCreateForm(false);
      setFormData({
        patientId: "",
        tests: [],
        urgency: "routine",
        clinicalNotes: "",
      });

      // Refresh lab orders after 1 second
      //window.location.herf = "doctor/dashbord";
    } catch (err) {
      console.error("Failed to create order:", err);
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Could not create laboratory order"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleTestToggle = (test: string) => {
    setFormData((prev) => ({
      ...prev,
      tests: prev.tests.includes(test)
        ? prev.tests.filter((t) => t !== test)
        : [...prev.tests, test],
    }));
  };

  const pendingOrders = labOrders.filter(
    (order) =>
      order.status === "pending" ||
      order.status === "in_progress" ||
      order.status === "PENDING" ||
      order.status === "IN_PROGRESS",
  );

  const completedOrders = labOrders.filter(
    (order) => order.status === "completed" || order.status === "COMPLETED",
  );

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient?.fullName || patient?.name || patientId;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Investigations"
        description="Create and track patient laboratory orders and results."
        actionLabel="New Lab Order"
        onAction={() => setShowCreateForm(true)}
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      {/* Create Lab Order Form */}
      {showCreateForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Create New Laboratory Order</CardTitle>
            <CardDescription>
              Select a patient and the tests to be performed in the laboratory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Patient Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Patient *</label>
                <select
                  value={formData.patientId}
                  onChange={(e) =>
                    setFormData({ ...formData, patientId: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                  required
                >
                  <option value="">Choose a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName || patient.name} (
                      {patient.id?.substring(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Tests *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-3 border rounded-lg bg-slate-50">
                  {labTestTypes.map((test) => (
                    <label
                      key={test}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.tests.includes(test)}
                        onChange={() => handleTestToggle(test)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{test}</span>
                    </label>
                  ))}
                </div>
                {formData.tests.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {formData.tests.length} test(s)
                  </div>
                )}
              </div>

              {/* Urgency */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency Level</label>
                <select
                  value={formData.urgency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      urgency: e.target.value as (typeof LAB_URGENCY)[number],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Clinical Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Clinical Notes</label>
                <textarea
                  value={formData.clinicalNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, clinicalNotes: e.target.value })
                  }
                  placeholder="Any clinical notes or observations for the lab..."
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isCreating ||
                    !formData.patientId ||
                    formData.tests.length === 0
                  }
                >
                  {isCreating ? "Creating..." : "Create Lab Order"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700">
              {labOrders.length}
            </div>
            <p className="text-xs text-muted-foreground">All lab orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {pendingOrders.length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting results</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {completedOrders.length}
            </div>
            <p className="text-xs text-muted-foreground">Results available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Ready to Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {completedOrders.filter((o) => labResults.has(o.id)).length}
            </div>
            <p className="text-xs text-muted-foreground">Results received</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </div>
      ) : (
        <>
          {/* Pending Lab Orders */}
          {pendingOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Laboratory Orders</CardTitle>
                <CardDescription>
                  Orders awaiting laboratory results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 border rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            Patient: {getPatientName(order.patientId)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Tests:{" "}
                            {Array.isArray(order.tests)
                              ? order.tests.join(", ")
                              : "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {formatDate(order.createdAt)}
                          </div>
                          {order.clinicalNotes && (
                            <div className="text-sm mt-2 p-2 bg-slate-100 rounded">
                              <strong>Notes:</strong> {order.clinicalNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant={
                              order.urgency === "routine"
                                ? "secondary"
                                : order.urgency === "urgent"
                                  ? "outline"
                                  : "destructive"
                            }
                          >
                            {order.urgency?.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">
                            {order.status?.replace(/_/g, " ").toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Lab Orders with Results */}
          {completedOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Completed Laboratory Orders</CardTitle>
                <CardDescription>Orders with available results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedOrders.map((order) => {
                    const result = labResults.get(order.id);
                    const isExpanded = expandedOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-4 bg-gradient-to-r from-green-50 to-teal-50 cursor-pointer hover:from-green-100 hover:to-teal-100 transition"
                          onClick={() =>
                            setExpandedOrderId(isExpanded ? null : order.id)
                          }
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">
                                Patient: {getPatientName(order.patientId)}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Tests:{" "}
                                {Array.isArray(order.tests)
                                  ? order.tests.join(", ")
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Order Date: {formatDate(order.createdAt)}
                              </div>
                              {result && (
                                <div className="text-xs text-green-700 font-medium mt-1">
                                  ✓ Result Available -{" "}
                                  {formatDate(
                                    result.submittedAt || result.updatedAt,
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="success">Completed</Badge>
                              {result && (
                                <Badge
                                  variant={
                                    result.status === "final"
                                      ? "success"
                                      : "secondary"
                                  }
                                >
                                  {result.status?.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Result Details */}
                        {isExpanded && result && (
                          <div className="p-4 border-t bg-slate-50">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">
                                  Laboratory Findings
                                </h4>
                                {typeof result.findings === "object" &&
                                result.findings !== null ? (
                                  <div className="space-y-2">
                                    {Object.entries(result.findings).map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className="p-3 bg-white rounded border"
                                        >
                                          <div className="font-medium text-sm">
                                            {key}
                                          </div>
                                          <div className="text-sm text-slate-600">
                                            {String(value)}
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-3 bg-white rounded border">
                                    <div className="text-sm">
                                      {String(result.findings)}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {result.fileUrl && (
                                <div>
                                  <h4 className="font-medium mb-2">
                                    Attachments
                                  </h4>
                                  <a
                                    href={result.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 transition"
                                  >
                                    📎 Download Lab Report
                                  </a>
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground">
                                <div>
                                  Result ID: {result.id?.substring(0, 8)}...
                                </div>
                                <div>
                                  Lab Technician:{" "}
                                  {result.labTechnicianId?.substring(0, 8)}...
                                </div>
                                <div>
                                  Status: {result.status?.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {labOrders.length === 0 && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Beaker className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium mb-1">
                  No Laboratory Orders
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first laboratory order to get started
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  Create New Lab Order
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
