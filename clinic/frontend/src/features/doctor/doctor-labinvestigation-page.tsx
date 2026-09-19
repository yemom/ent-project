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

interface LabOrderRow {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  tests: string[];
  urgency: string;
  clinicalNotes?: string;
  status: string;
  createdAt: string;
}

interface LabResultDetail {
  id: string;
  labOrderId: string;
  labTechnicianId?: string;
  findings: Record<string, string> | string;
  fileUrl?: string | null;
  status: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export function DoctorLabInvestigationsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderSearch, setOrderSearch] = useState(searchParams.get("q") ?? "");

  // ── Order list state ──────────────────────────────────────────────────────
  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // ── Create-order form state ───────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<string>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<StatusType>(null);
  const [formStatusMessage, setFormStatusMessage] = useState("");

  // ── Result-detail modal state ─────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<LabOrderRow | null>(null);
  const [result, setResult] = useState<LabResultDetail | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  useEffect(() => {
    setOrderSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  // ── Fetch all lab orders for this doctor ─────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoadingOrders(true);
      setOrdersError(null);
      const data = await labOrdersService.list({ doctorId: user.id, size: 50 });
      const items: LabOrderRow[] = (
        Array.isArray(data) ? data : ((data as any)?.content ?? [])
      ).map((o: any) => ({
        id: o.id,
        patientId: o.patientId,
        patientName: o.patientName ?? o.patientId,
        doctorId: o.doctorId,
        tests: Array.isArray(o.tests) ? o.tests : [],
        urgency: o.urgency ?? "routine",
        clinicalNotes: o.clinicalNotes,
        status: o.status ?? "PENDING",
        createdAt: o.createdAt,
      }));
      setOrders(items);
    } catch (err) {
      setOrdersError(
        getFriendlyErrorMessage(err, "Could not load lab orders."),
      );
    } finally {
      setIsLoadingOrders(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await listPatients({ size: 100 });
        setPatients(data.content ?? []);
      } catch {
        /* silent */
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId || orders.length === 0) return;
    const matchedOrder = orders.find((order) => order.id === orderId);
    if (matchedOrder && selectedOrder?.id !== matchedOrder.id) {
      void openResultDetail(matchedOrder);
    }
  }, [orders, searchParams, selectedOrder?.id]);

  // ── Submit new lab order ──────────────────────────────────────────────────
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPatientName = patientSearchInput.trim();
    if (!user?.id || !finalPatientName || selectedTests.length === 0) {
      setFormStatus("error");
      setFormStatusMessage(
        "Please write a patient name and select at least one test.",
      );
      return;
    }

    // Resolve patientId: if typed name matches a registered patient, link by UUID. Otherwise use raw typed name string!
    const matchedPatient = patients.find(
      (p) => p.fullName?.toLowerCase() === finalPatientName.toLowerCase(),
    );
    const finalPatientId = matchedPatient
      ? matchedPatient.id
      : finalPatientName;

    try {
      setIsSubmitting(true);
      setFormStatus(null);
      await labOrdersService.create({
        patientId: finalPatientId,
        doctorId: user.id,
        tests: selectedTests,
        urgency: urgency ? (urgency.toUpperCase() as any) : "ROUTINE",
        clinicalNotes:
          clinicalNotes.trim() || "Routine investigation ordered by doctor.",
      });
      setFormStatus("success");
      setFormStatusMessage(
        "Lab order created and sent to laboratory successfully!",
      );
      setShowCreateForm(false);
      setSelectedPatientId("");
      setPatientSearchInput("");
      setSelectedTests([]);
      setUrgency("routine");
      setClinicalNotes("");
      await fetchOrders();
    } catch (err) {
      setFormStatus("error");
      setFormStatusMessage(
        getFriendlyErrorMessage(err, "Failed to create lab order."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Open result detail modal and fetch real result ────────────────────────
  const openResultDetail = async (order: LabOrderRow) => {
    setSelectedOrder(order);
    setResult(null);
    setResultError(null);
    setIsLoadingResult(true);
    try {
      const r = await labResultsService.getByLabOrderId(order.id);
      setResult(r as LabResultDetail | null);
    } catch (err) {
      setResultError(
        getFriendlyErrorMessage(err, "Could not load lab result."),
      );
    } finally {
      setIsLoadingResult(false);
    }
  };

  const toggleTest = (test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test],
    );
  };

  const updateOrderSearch = (value: string) => {
    setOrderSearch(value);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      nextParams.set("q", value.trim());
    } else {
      nextParams.delete("q");
    }
    const nextQuery = nextParams.toString();
    router.replace(
      nextQuery ? `/doctor/laboratory?${nextQuery}` : "/doctor/laboratory",
    );
  };

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) => {
      const searchableValues = [
        order.patientName,
        order.patientId,
        order.doctorId,
        order.urgency,
        order.status,
        order.clinicalNotes,
        ...order.tests,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return searchableValues.some((value) => value.includes(query));
    });
  }, [orderSearch, orders]);

  const urgencyBadge = (u: string): "destructive" | "warning" | "outline" => {
    if (u === "critical") return "destructive";
    if (u === "urgent") return "warning";
    return "outline";
  };

  const statusBadge = (
    s: string,
  ): "success" | "default" | "destructive" | "warning" => {
    const sl = (s ?? "").toLowerCase();
    if (sl === "completed") return "success";
    if (sl === "in_progress") return "default";
    if (sl === "cancelled") return "destructive";
    return "warning";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Investigations"
        description="Create investigation orders and review real laboratory results."
        actionLabel="New Lab Order"
        onAction={() => {
          setShowCreateForm((v) => !v);
          setFormStatus(null);
        }}
      />

      <StatusAlert
        status={formStatus}
        message={formStatusMessage}
        onDismiss={() => setFormStatus(null)}
        autoDismiss
        autoDismissMs={4000}
      />

      {/* ── Create Lab Order Form ─────────────────────────────────── */}
      {showCreateForm && (
        <Card className="border-teal-300 shadow-md">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-white border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-teal-700" />
                <CardTitle>New Lab Investigation Order</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreateForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Select a patient, choose the required tests, set urgency and add
              clinical notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleCreateOrder} className="space-y-5">
              {/* Patient */}
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold">Patient Name *</label>
                <Input
                  type="text"
                  placeholder="Write patient's name..."
                  className="h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:ring-teal-500"
                  value={patientSearchInput}
                  onChange={(e) => {
                    setPatientSearchInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  required
                />

                {/* Suggestions Autocomplete Box */}
                {showSuggestions &&
                  patientSearchInput.trim().length > 0 &&
                  (() => {
                    const filtered = patients.filter((p) =>
                      p.fullName
                        ?.toLowerCase()
                        .includes(patientSearchInput.toLowerCase()),
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-lg divide-y divide-gray-100">
                        {filtered.map((p) => (
                          <div
                            key={p.id}
                            className="px-4 py-2.5 hover:bg-teal-50 text-sm cursor-pointer transition-colors text-gray-700 flex justify-between items-center"
                            onClick={() => {
                              setPatientSearchInput(p.fullName);
                              setSelectedPatientId(p.id);
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="font-medium">{p.fullName}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              Registered
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
              </div>

              {/* Test selection – checkbox grid */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Tests to Order *
                </label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {LAB_TEST_TYPES.map((test) => (
                    <label
                      key={test}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                        selectedTests.includes(test)
                          ? "border-teal-500 bg-teal-50 font-medium text-teal-800"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-600"
                        checked={selectedTests.includes(test)}
                        onChange={() => toggleTest(test)}
                      />
                      {test}
                    </label>
                  ))}
                </div>
                {selectedTests.length > 0 && (
                  <p className="text-xs text-teal-700 font-medium">
                    Selected: {selectedTests.join(" • ")}
                  </p>
                )}
              </div>

              {/* Urgency */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Urgency Level *</label>
                <div className="flex gap-3">
                  {LAB_URGENCY.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium capitalize transition-colors ${
                        urgency === u
                          ? u === "critical"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : u === "urgent"
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-border bg-background hover:bg-muted/40"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Clinical Notes</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Relevant clinical context, symptoms, or indications for these tests..."
                  className="min-h-[90px] w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="rounded-2xl bg-teal-700 px-8 hover:bg-teal-800"
                  disabled={
                    isSubmitting ||
                    selectedTests.length === 0 ||
                    !patientSearchInput.trim()
                  }
                >
                  {isSubmitting ? "Sending to Lab..." : "Submit Lab Order"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Orders Table ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-teal-700" />
              <div>
                <CardTitle>My Lab Orders</CardTitle>
                <CardDescription>
                  Real-time orders and completed results from your laboratory
                  workflow
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              {filteredOrders.length} shown / {orders.length} total
            </Badge>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={orderSearch}
              onChange={(e) => updateOrderSearch(e.target.value)}
              placeholder="Search patient, test, urgency, status, or notes..."
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingOrders ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : ordersError ? (
            <p className="p-6 text-sm text-destructive">{ordersError}</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
              <Beaker className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                No lab orders found. Click "New Lab Order" to get started.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
              <Search className="h-12 w-12 opacity-30" />
              <p className="text-sm">No lab orders match your search.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Patient</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      {order.patientName ?? order.patientId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {order.tests.slice(0, 2).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                        {order.tests.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{order.tests.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={urgencyBadge(order.urgency)}
                        className="capitalize"
                      >
                        {order.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadge(order.status)}
                        className="capitalize"
                      >
                        {(order.status ?? "").toLowerCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString([], {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={
                          (order.status ?? "").toLowerCase() === "completed"
                            ? "default"
                            : "outline"
                        }
                        className="rounded-xl"
                        onClick={() => openResultDetail(order)}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" />
                        {(order.status ?? "").toLowerCase() === "completed"
                          ? "View Result"
                          : "Details"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Result Detail Modal ───────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-teal-50 to-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                  <Beaker className="h-5 w-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Lab Result Detail</h3>
                  <p className="text-sm text-muted-foreground">
                    Patient:{" "}
                    <span className="font-medium">
                      {selectedOrder.patientName ?? selectedOrder.patientId}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => {
                  setSelectedOrder(null);
                  setResult(null);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Order summary */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Urgency
                  </p>
                  <Badge
                    variant={urgencyBadge(selectedOrder.urgency)}
                    className="mt-1 capitalize"
                  >
                    {selectedOrder.urgency}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Order Status
                  </p>
                  <Badge
                    variant={statusBadge(selectedOrder.status)}
                    className="mt-1 capitalize"
                  >
                    {(selectedOrder.status ?? "")
                      .toLowerCase()
                      .replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ordered
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tests Ordered
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedOrder.tests.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              {selectedOrder.clinicalNotes && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Clinical Notes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    "{selectedOrder.clinicalNotes}"
                  </p>
                </div>
              )}
            </div>

            {/* Lab result content */}
            <div className="max-h-[48vh] overflow-y-auto px-6 py-5 space-y-4">
              {isLoadingResult ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : resultError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {resultError}
                </div>
              ) : !result ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                  <FlaskConical className="h-12 w-12 opacity-25" />
                  <p className="text-sm font-medium">No result available yet</p>
                  <p className="text-xs">
                    The laboratory has not submitted results for this order yet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Result meta */}
                  <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        Result Status:{" "}
                        <span className="capitalize">{result.status}</span>
                      </p>
                      {result.submittedAt && (
                        <p className="text-xs text-green-700 mt-0.5">
                          Submitted:{" "}
                          {new Date(result.submittedAt).toLocaleString()}
                        </p>
                      )}
                      {result.labTechnicianId && (
                        <p className="text-xs text-green-700 mt-0.5">
                          Lab Technician ID: {result.labTechnicianId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Findings */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-600" />
                      Laboratory Findings
                    </h4>
                    {typeof result.findings === "string" ? (
                      <div className="rounded-2xl border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                        {result.findings}
                      </div>
                    ) : result.findings &&
                      typeof result.findings === "object" &&
                      Object.keys(result.findings).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(result.findings).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between rounded-xl border border-border bg-muted/20 px-4 py-3"
                          >
                            <span className="text-sm font-semibold text-slate-700">
                              {key}
                            </span>
                            <span className="ml-4 text-sm text-slate-900 text-right max-w-[60%]">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No structured findings recorded.
                      </p>
                    )}
                  </div>

                  {/* File attachment */}
                  {result.fileUrl && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-2">
                        Attached Report
                      </p>
                      <a
                        href={result.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Download / View Lab Report
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex justify-end">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setSelectedOrder(null);
                  setResult(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
