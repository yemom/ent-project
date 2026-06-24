"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Package,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { StatusAlert, type StatusType } from "@/components/shared/status-alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layouts/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { usePrescriptionOrders } from "@/hooks/usePrescriptionOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { getFriendlyErrorMessage } from "@/lib/error-handler";
import { useAuthStore } from "@/store/auth-store";

function formatQueueAge(value?: string) {
  if (!value) return "Received recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Received recently";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 1) return "Received just now";
  if (minutes < 60) return `Received ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Received ${hours}h ago`;
  return `Received ${Math.round(hours / 24)}d ago`;
}

function getQueueStyle(
  order: { drugName: string; instructions?: string; orderedAt?: string },
  index: number,
) {
  const text = `${order.drugName} ${order.instructions ?? ""}`.toLowerCase();
  const ageMinutes = order.orderedAt
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(order.orderedAt).getTime()) / 60000),
      )
    : 0;
  if (
    index === 0 ||
    text.includes("stat") ||
    text.includes("urgent") ||
    ageMinutes > 90
  ) {
    return {
      label: "STAT",
      action: "Process Now",
      icon: Zap,
      border: "border-red-400",
      iconWrap: "bg-red-100 text-red-600",
      accent: "text-teal-700",
      tags: ["IMMEDIATE", "HIGH RISK"],
    };
  }
  if (
    index === 1 ||
    text.includes("antibiotic") ||
    text.includes("amoxicillin") ||
    ageMinutes > 45
  ) {
    return {
      label: "Urgent",
      action: "Next in Queue",
      icon: AlertCircle,
      border: "border-orange-300",
      iconWrap: "bg-orange-100 text-orange-700",
      accent: "text-teal-700",
      tags: ["WITHIN 1HR", "ANTIBIOTIC"],
    };
  }
  return {
    label: "Routine",
    action: "Review Order",
    icon: Package,
    border: "border-teal-300",
    iconWrap: "bg-teal-100 text-teal-700",
    accent: "text-teal-700",
    tags: ["STANDARD", "REFILL"],
  };
}

// ============================================================================
// PharmacistDashboardPage
//
// Main landing page for pharmacists showing stats and recent orders.
// ============================================================================
export function PharmacistDashboardPage() {
  const { orders, isLoading, error } = usePrescriptionOrders();

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "PENDING").length,
      dispensed: orders.filter((o) => o.status === "DISPENSED").length,
    };
  }, [orders]);

  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  const activeQueue = useMemo(() => {
    return orders
      .filter((order) => order.status === "PENDING")
      .sort(
        (left, right) =>
          new Date(left.orderedAt).getTime() -
          new Date(right.orderedAt).getTime(),
      );
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy Dashboard"
        description={`Active queue: ${stats.pending} prescriptions pending fulfillment`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
            <CardDescription>All prescription orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-700">
              {stats.total}
            </div>
            <Package className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
            <CardDescription>Awaiting fulfillment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {stats.pending}
            </div>
            <Clock className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispensed Today</CardTitle>
            <CardDescription>Completed orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.dispensed}
            </div>
            <Check className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 px-0">
          <div>
            <CardTitle>Active Queue</CardTitle>
            <CardDescription>
              {stats.pending} prescriptions pending fulfillment
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="rounded-md">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </Button>
            <Button variant="secondary" size="sm" className="rounded-md">
              <SlidersHorizontal className="h-4 w-4" />
              Priority
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : activeQueue.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No pending prescriptions in the active queue.
            </div>
          ) : (
            activeQueue.slice(0, 3).map((order, index) => {
              const style = getQueueStyle(order, index);
              const Icon = style.icon;
              return (
                <div
                  key={order.id}
                  className={`flex items-center justify-between gap-4 rounded-lg border-2 ${style.border} bg-white p-4`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700">
                        {style.label}: {order.drugName} {order.dosage}
                      </p>
                      <p className="text-sm font-medium text-slate-600">
                        Patient: {order.patientName}{" "}
                        <span className="text-muted-foreground">
                          • Dr. {order.doctorName}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {style.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="rounded-sm text-[10px] font-bold"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {formatQueueAge(order.orderedAt)}
                    </p>
                    <Button
                      variant="ghost"
                      className={`mt-2 px-0 font-bold ${style.accent}`}
                      onClick={() => {
                        window.location.href = "/pharmacist/orders";
                      }}
                    >
                      {style.action}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PharmacistOrdersPage
//
// Displays all prescription orders with filtering and status updates.
// ============================================================================
export function PharmacistOrdersPage() {
  const urlQuery = useSearchParams().get("q") ?? "";
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "PENDING" | "DISPENSED" | "REJECTED"
  >("ALL");
  const [query, setQuery] = useState(urlQuery);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const statusFilter =
    filterStatus === "ALL"
      ? undefined
      : (filterStatus as "PENDING" | "DISPENSED" | "REJECTED");
  const { orders, isLoading } = usePrescriptionOrders({ status: statusFilter });

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const filteredOrders = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.toLowerCase();
    return orders.filter((order) =>
      [order.drugName, order.patientName, order.doctorName, order.dosage].some(
        (value) => value.toLowerCase().includes(q),
      ),
    );
  }, [query, orders]);

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: "DISPENSED" | "REJECTED",
  ) => {
    try {
      setUpdatingId(orderId);
      await apiClient.patch(`/prescription-orders/${orderId}/status`, {
        status: newStatus,
      });
      setStatus("success");
      setStatusMessage(
        `Order marked as ${newStatus.toLowerCase()} successfully!`,
      );
      // Refresh the page or update state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        getFriendlyErrorMessage(
          err,
          "We could not update the order status right now. Please try again.",
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription Orders"
        description="Review and fulfill prescription orders from doctors."
      />

      <StatusAlert
        status={status}
        message={statusMessage}
        onDismiss={() => setStatus(null)}
        autoDismiss={true}
        autoDismissMs={3500}
      />

      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "DISPENSED", "REJECTED"] as const).map(
          (status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              onClick={() => setFilterStatus(status)}
              className="rounded-full"
            >
              {status}
            </Button>
          ),
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 rounded-2xl border border-input bg-background p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder="Search by drug name, patient, doctor, or dosage..."
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No prescription orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Drug</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Ordered At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.patientName}
                      </TableCell>
                      <TableCell>{order.drugName}</TableCell>
                      <TableCell>{order.dosage}</TableCell>
                      <TableCell>{order.doctorName}</TableCell>
                      <TableCell>
                        {new Date(order.orderedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.status === "PENDING"
                              ? "warning"
                              : order.status === "DISPENSED"
                                ? "success"
                                : "destructive"
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={updatingId === order.id}
                              onClick={() =>
                                handleStatusUpdate(order.id, "DISPENSED")
                              }
                              className="rounded-lg"
                            >
                              {updatingId === order.id ? "..." : "Dispense"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={updatingId === order.id}
                              onClick={() =>
                                handleStatusUpdate(order.id, "REJECTED")
                              }
                              className="rounded-lg"
                            >
                              {updatingId === order.id ? "..." : "Reject"}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PharmacistProfilePage
//
// Displays pharmacist profile information.
// ============================================================================
export function PharmacistProfilePage() {
  const authUser = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacist Profile"
        description="Your profile information and settings."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Full Name
              </label>
              <p className="mt-1 text-lg font-semibold">
                {authUser?.fullName || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <p className="mt-1 text-lg font-semibold">
                {authUser?.email || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Role
              </label>
              <Badge className="mt-2" variant="outline">
                {authUser?.role || "N/A"}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Phone
              </label>
              <p className="mt-1 text-lg font-semibold">
                {authUser?.phone || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
