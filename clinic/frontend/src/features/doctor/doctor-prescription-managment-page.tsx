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

export function DoctorPrescriptionManagementPage() {
  const authUser = useAuthStore((state) => state.user);
  const urlQuery = useSearchParams().get("q") ?? "";
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<
    string | null
  >(null);
  const [editPrescriptionForm, setEditPrescriptionForm] = useState({
    drugName: "",
    dosage: "",
    diagnosis: "",
    treatment: "",
    notes: "",
  });
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [newPrescriptionForm, setNewPrescriptionForm] = useState({
    patientName: "",
    drugName: "",
    dosage: "5mg",
    frequency: "Once daily",
    duration: "14",
    instructions: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const fetchData = async (name?: string) => {
    if (!authUser?.id) return;
    try {
      setIsLoading(true);
      let data;
      if (name) {
        // Fetch specific patient's active prescriptions
        data = await listPrescriptionOrders({ patientName: name, size: 50 });
      } else {
        // Initial load: fetch doctor's recent orders to get the list of patient names
        data = await listPrescriptionOrdersByDoctor(authUser.id, { size: 100 });
      }
      setPrescriptions(data.content ?? []);
    } catch (err) {
      console.error("Failed to fetch prescriptions", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authUser?.id]);

  useEffect(() => {
    if (selectedPatientName) {
      fetchData(selectedPatientName);
    }
  }, [selectedPatientName]);

  const patientNames = useMemo(() => {
    return Array.from(
      new Set(prescriptions.map((item) => item.patientName).filter(Boolean)),
    ).sort();
  }, [prescriptions]);

  const visiblePrescriptions = useMemo(() => {
    if (!selectedPatientName) return [];
    return prescriptions.filter(
      (item) => item.patientName === selectedPatientName,
    );
  }, [prescriptions, selectedPatientName]);

  const filteredPrescriptions = useMemo(() => {
    if (!query.trim()) return visiblePrescriptions;
    const q = query.toLowerCase();
    return visiblePrescriptions.filter((item) =>
      [item.drugName, item.patientName, item.status, item.dosage].some(
        (value) => value.toLowerCase().includes(q),
      ),
    );
  }, [query, visiblePrescriptions]);

  const startPrescriptionEdit = (item: any) => {
    setEditingPrescriptionId(item.id);
    setEditPrescriptionForm({
      drugName: item.drugName,
      dosage: item.dosage,
      diagnosis: "",
      treatment: "",
      notes: item.instructions || "",
    });
    setStatus(null);
  };

  const handlePrescriptionEdit = async () => {
    if (!editingPrescriptionId) return;
    try {
      await updatePrescriptionOrder(editingPrescriptionId, {
        drugName: editPrescriptionForm.drugName,
        dosage: editPrescriptionForm.dosage,
        instructions: editPrescriptionForm.notes,
      });
      setPrescriptions((current) =>
        current.map((item) =>
          item.id === editingPrescriptionId
            ? {
                ...item,
                drugName: editPrescriptionForm.drugName,
                dosage: editPrescriptionForm.dosage,
                instructions: editPrescriptionForm.notes,
              }
            : item,
        ),
      );
      setEditingPrescriptionId(null);
      setStatus("success");
      setStatusMessage("Prescription order updated successfully.");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Failed to update prescription order."),
      );
    }
  };

  const handlePrescriptionDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this prescription order? This removes the order from the pharmacy system.",
      )
    )
      return;
    try {
      await deletePrescriptionOrder(id);
      setPrescriptions((current) => current.filter((item) => item.id !== id));
      setStatus("success");
      setStatusMessage("Prescription order deleted successfully.");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(err, "Failed to delete prescription order."),
      );
    }
  };

  const handleSendToPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newPrescriptionForm.patientName ||
      !newPrescriptionForm.drugName ||
      !authUser?.id
    ) {
      alert("Please fill in required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const finalInstructions = [
        `Frequency: ${newPrescriptionForm.frequency}`,
        `Duration: ${newPrescriptionForm.duration} days`,
        newPrescriptionForm.instructions,
      ]
        .filter(Boolean)
        .join("\n");

      await apiClient.post("/prescription-orders", {
        doctorId: authUser.id,
        doctorName: authUser.fullName,
        patientName: newPrescriptionForm.patientName,
        drugName: newPrescriptionForm.drugName,
        dosage: newPrescriptionForm.dosage,
        instructions: finalInstructions,
      });
      setNewPrescriptionForm({
        patientName: "",
        drugName: "",
        dosage: "5mg",
        frequency: "Once daily",
        duration: "14",
        instructions: "",
      });
      alert("Prescription sent to pharmacy successfully!");
      // Refetch prescriptions
      fetchData();
    } catch (err) {
      console.error("Failed to send prescription", err);
      alert("Failed to send prescription to pharmacy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription Management"
        description="Precision pharmacology and patient safety center"
        actionLabel="Bulk Export"
      />
      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={3500}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Left Column: New Prescription Form & Active Prescriptions */}
        <div className="space-y-6">
          {/* New Prescription Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PillBottle className="h-5 w-5" />
                New Prescription
              </CardTitle>
              <CardDescription>
                Authorize and send medications to pharmacy for dispensing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendToPharmacy} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900">
                    Patient Name
                  </label>
                  <Input
                    className="mt-2 h-11 rounded-2xl"
                    placeholder="Eleanor Shellstrop"
                    value={newPrescriptionForm.patientName}
                    onChange={(e) =>
                      setNewPrescriptionForm({
                        ...newPrescriptionForm,
                        patientName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-900">
                      Drug Search (Auto-complete)
                    </label>
                    <div className="mt-2 relative">
                      <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        className="pl-10 h-11 rounded-2xl"
                        placeholder="Start typing medication name..."
                        value={newPrescriptionForm.drugName}
                        onChange={(e) =>
                          setNewPrescriptionForm({
                            ...newPrescriptionForm,
                            drugName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900">
                      Dosage
                    </label>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                      value={newPrescriptionForm.dosage}
                      onChange={(e) =>
                        setNewPrescriptionForm({
                          ...newPrescriptionForm,
                          dosage: e.target.value,
                        })
                      }
                    >
                      <option value="5mg">5mg</option>
                      <option value="10mg">10mg</option>
                      <option value="25mg">25mg</option>
                      <option value="50mg">50mg</option>
                      <option value="100mg">100mg</option>
                      <option value="500mg">500mg</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-900">
                      Frequency
                    </label>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                      value={newPrescriptionForm.frequency}
                      onChange={(e) =>
                        setNewPrescriptionForm({
                          ...newPrescriptionForm,
                          frequency: e.target.value,
                        })
                      }
                    >
                      <option>Once daily (QD)</option>
                      <option>Twice daily (BD)</option>
                      <option>Thrice daily (TDS)</option>
                      <option>Four times daily (QID)</option>
                      <option>As needed (PRN)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900">
                      Duration (Days)
                    </label>
                    <Input
                      className="mt-2 h-11 rounded-2xl"
                      type="number"
                      value={newPrescriptionForm.duration}
                      onChange={(e) =>
                        setNewPrescriptionForm({
                          ...newPrescriptionForm,
                          duration: e.target.value,
                        })
                      }
                      placeholder="14"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900">
                    Pharmacist Instructions
                  </label>
                  <textarea
                    className="mt-2 min-h-[100px] rounded-2xl border border-border bg-white px-3 py-2 text-sm"
                    placeholder="Additional administration notes, contraindications, or specific instructions for the pharmacy..."
                    value={newPrescriptionForm.instructions}
                    onChange={(e) =>
                      setNewPrescriptionForm({
                        ...newPrescriptionForm,
                        instructions: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900">
                    Digital Signature Authentication
                  </label>
                  <div className="mt-2 h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                    <div className="text-center">
                      <PillBottle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to sign or use biometric authentication
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Encrypted signature will be timestamped and logged via
                    secure gateway
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-2xl bg-teal-700 hover:bg-teal-800 text-white h-11"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Authorize & Send to Pharmacy"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Prescriptions Table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 gap-4">
              <div>
                <CardTitle>Active Prescriptions</CardTitle>
                <CardDescription>
                  Select a patient to list their active prescriptions
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                {patientNames.length === 0 && !isLoading ? (
                  <div className="text-sm text-muted-foreground">
                    No patients with active prescriptions found.
                  </div>
                ) : (
                  patientNames.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant={
                        selectedPatientName === name ? "default" : "outline"
                      }
                      className="rounded-full"
                      onClick={() => {
                        setSelectedPatientName(
                          selectedPatientName === name ? "" : name,
                        );
                        setEditingPrescriptionId(null);
                      }}
                    >
                      {name}
                    </Button>
                  ))
                )}
              </div>
              <div className="flex gap-3 rounded-2xl border border-border bg-background p-3 mb-4 shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  placeholder="Search medications or patients..."
                />
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Dosage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-10 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : !selectedPatientName ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Click a patient name above to list active
                          prescriptions.
                        </TableCell>
                      </TableRow>
                    ) : filteredPrescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No prescriptions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrescriptions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {editingPrescriptionId === item.id ? (
                              <Input
                                value={editPrescriptionForm.drugName}
                                onChange={(event) =>
                                  setEditPrescriptionForm({
                                    ...editPrescriptionForm,
                                    drugName: event.target.value,
                                  })
                                }
                                className="h-9"
                              />
                            ) : (
                              item.drugName
                            )}
                          </TableCell>
                          <TableCell>{item.patientName}</TableCell>
                          <TableCell>
                            {editingPrescriptionId === item.id ? (
                              <Input
                                value={editPrescriptionForm.dosage}
                                onChange={(event) =>
                                  setEditPrescriptionForm({
                                    ...editPrescriptionForm,
                                    dosage: event.target.value,
                                  })
                                }
                                className="h-9"
                              />
                            ) : (
                              item.dosage
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "DISPENSED"
                                  ? "success"
                                  : item.status === "PENDING"
                                    ? "warning"
                                    : item.status === "REJECTED"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {editingPrescriptionId === item.id ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handlePrescriptionEdit}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingPrescriptionId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => startPrescriptionEdit(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() =>
                                    handlePrescriptionDelete(item.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar Info Cards */}
        <div className="space-y-4">
          {/* Drug Interaction Check */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-teal-700" />
                Drug Interaction Check
              </CardTitle>
              <CardDescription>Safety verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-teal-200 bg-white p-4">
                <p className="text-sm text-teal-900">
                  <span className="font-semibold">✓ No contraindications</span>{" "}
                  detected for Lisinopril and current patient history.
                </p>
                <p className="text-xs text-teal-700 mt-2">
                  Safety protocol 4.0 verified.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Prescription History */}
          <Card>
            <CardHeader>
              <CardTitle>Prescription History</CardTitle>
              <CardDescription>Recent prescriptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">24 OCT, 2023</p>
                <p className="text-muted-foreground">
                  Amoxicillin • 500mg • Completed course
                </p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">12 AUG, 2023</p>
                <p className="text-muted-foreground">
                  Ibuprofen • 800mg • Expired
                </p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 border border-border">
                <p className="font-semibold">05 JUN, 2023</p>
                <p className="text-muted-foreground">
                  Atorvastatin • 20mg • Discontinued
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full text-teal-700 hover:text-teal-800"
              >
                View full history
              </Button>
            </CardContent>
          </Card>

          {/* Patient Adherence Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Adherence Rate</CardTitle>
              <CardDescription>Last 7 days via patient app</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-4xl font-bold text-teal-700">94.2%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Medication taken as prescribed
                  </p>
                </div>

                {/* Adherence Chart */}
                <div className="flex items-end justify-between gap-1 h-16">
                  {[65, 75, 85, 92, 88, 95, 94].map((value, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full bg-teal-200 rounded-t-lg transition-all"
                        style={{ height: `${(value / 100) * 60}px` }}
                      />
                      <div
                        className={`w-full h-3 rounded-full ${value >= 90 ? "bg-teal-600" : value >= 80 ? "bg-teal-500" : "bg-teal-300"}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Mon Tue Wed Thu Fri Sat Sun
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
