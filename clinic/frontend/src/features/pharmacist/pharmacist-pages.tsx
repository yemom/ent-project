"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, X, Clock, Package } from "lucide-react";
import { apiClient } from "@/services/api/client";
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
import { useAuthStore } from "@/store/auth-store";

// ============================================================================
// PharmacistDashboardPage
//
// Main landing page for pharmacists showing stats and recent orders.
// ============================================================================
export function PharmacistDashboardPage() {
  const { orders, isLoading } = usePrescriptionOrders();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy Dashboard"
        description="Manage prescription orders and track pharmacy operations."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
            <CardDescription>All prescription orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-700">{stats.total}</div>
            <Package className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
            <CardDescription>Awaiting fulfillment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.pending}</div>
            <Clock className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispensed Today</CardTitle>
            <CardDescription>Completed orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.dispensed}</div>
            <Check className="mt-2 h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest prescription orders from doctors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </>
          ) : recentOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent orders.</div>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-semibold">{order.drugName}</p>
                  <p className="text-sm text-muted-foreground">
                    Patient: {order.patientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ordered: {new Date(order.orderedAt).toLocaleString()}
                  </p>
                </div>
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
              </div>
            ))
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
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "PENDING" | "DISPENSED" | "REJECTED"
  >("ALL");
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const statusFilter =
    filterStatus === "ALL"
      ? undefined
      : (filterStatus as "PENDING" | "DISPENSED" | "REJECTED");
  const { orders, isLoading } = usePrescriptionOrders({ status: statusFilter });

  const filteredOrders = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.toLowerCase();
    return orders.filter((order) =>
      [
        order.drugName,
        order.patientName,
        order.doctorName,
        order.dosage,
      ].some((value) => value.toLowerCase().includes(q))
    );
  }, [query, orders]);

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: "DISPENSED" | "REJECTED"
  ) => {
    try {
      setUpdatingId(orderId);
      await apiClient.patch(`/prescription-orders/${orderId}/status`, {
        status: newStatus,
      });
      // Refresh the page or update state
      window.location.reload();
    } catch (err) {
      console.error("Failed to update order status", err);
      alert("Failed to update order status. Please try again.");
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

      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "DISPENSED", "REJECTED"] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            onClick={() => setFilterStatus(status)}
            className="rounded-full"
          >
            {status}
          </Button>
        ))}
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
