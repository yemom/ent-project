'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  CalendarClock,
  PillBottle,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { useAuthStore } from '@/store/auth-store';
import { PERMISSIONS } from '@/features/auth/permissions';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import {
  PHARMACY_KEYS,
  createMedicine,
  deleteMedicine,
  fetchAlerts,
  fetchPharmacySummary,
  listBatches,
  listCategories,
  listMedicines,
  listMovements,
  listSuppliers,
  receiveStock,
  recordMovement,
  type MedicineWithStock,
  type MovementKind,
  type StockBatch,
} from '@/services/api/pharmacy';

/**
 * Pharmacy inventory.
 *
 * <p>Every number is what the server derived from the batch ledger. Write controls
 * are gated on `inventory:manage` / `batch:manage` so the screen only offers what
 * the API will accept — the pharmacist and the admin see them, a doctor does not.
 */

const MOVEMENT_VARIANT: Record<MovementKind, 'success' | 'warning' | 'destructive' | 'outline'> = {
  RECEIVED: 'success',
  DISPENSED: 'outline',
  RETURNED: 'success',
  DAMAGED: 'destructive',
  EXPIRED: 'destructive',
  ADJUSTED: 'warning',
};

export function PharmacyDashboardPage() {
  const { data: summary, isLoading } = useSummary();
  const { data: alerts } = useAlerts();

  const alertCount =
    (alerts?.outOfStock.length ?? 0) +
    (alerts?.lowStock.length ?? 0) +
    (alerts?.expired.length ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy"
        description="Catalogue, stock levels, batches and the movement ledger."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Medicines"
          value={summary?.medicines ?? 0}
          icon={PillBottle}
          loading={isLoading}
        />
        <Metric
          label="Stock value"
          value={summary?.stockValue ?? 0}
          icon={Boxes}
          money
          loading={isLoading}
        />
        <Metric
          label="Alerts"
          value={alertCount}
          icon={AlertTriangle}
          loading={isLoading}
        />
        <Metric
          label="COGS this month"
          value={summary?.costOfGoodsDispensedInPeriod ?? 0}
          icon={ArrowDownCircle}
          money
          loading={isLoading}
        />
      </div>

      <AlertPanels />
      <MedicineTable />
      <StockMovementLedger />
    </div>
  );
}

export function PharmacyInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Live stock per medicine, derived from batches. Expiry and reorder alerts included."
      />
      <AlertPanels />
      <MedicineTable />
    </div>
  );
}

export function PharmacyBatchesPage() {
  const { data, isLoading } = useBatches();
  const batches = data?.content ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches & Expiry"
        description="Every lot with its own expiry date and purchase cost."
      />
      <ReceiveStockForm />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Batches
          </CardTitle>
          <CardDescription>Nearest expiry first — the order stock should be dispensed in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-2xl" />
          ) : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock received yet.</p>
          ) : (
            batches.map((batch) => <BatchRow key={batch.id} batch={batch} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================== medicines ==============================

function useMedicines(q: string, category: string, alertsOnly: boolean) {
  return useQuery({
    queryKey: PHARMACY_KEYS.medicines(q, category, alertsOnly),
    queryFn: () => listMedicines({ q: q || undefined, category: category || undefined, alertsOnly }),
    staleTime: 30_000,
  });
}

function MedicineTable() {
  const canManage = useAuthStore((state) => state.hasPermission(PERMISSIONS.INVENTORY_MANAGE));
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [editing, setEditing] = useState<MedicineWithStock | null>(null);

  const { data: categories } = useCategories();
  const { data, isLoading } = useMedicines(q, category, alertsOnly);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const remove = useMutation({
    mutationFn: deleteMedicine,
    onSuccess: () => {
      setStatus('success');
      setMessage('Medicine removed from the catalogue.');
      void queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
    },
    onError: (error) => {
      // The API refuses while stock is held; show that verbatim.
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That medicine could not be deleted.'));
    },
  });

  const medicines = data?.content ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PillBottle className="h-4 w-4" /> Medicines
        </CardTitle>
        <CardDescription>{data?.totalElements ?? 0} catalogue entr(ies).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-2xl border border-input bg-background p-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name or code..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {(categories ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button variant={alertsOnly ? 'default' : 'outline'} onClick={() => setAlertsOnly(!alertsOnly)}>
            <AlertTriangle className="h-4 w-4" /> Alerts only
          </Button>
        </div>

        {canManage ? (
          <MedicineForm
            key={editing?.medicine.id ?? 'new'}
            entry={editing}
            onDone={(text) => {
              setEditing(null);
              setStatus('success');
              setMessage(text);
              void queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </>
        ) : medicines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {alertsOnly ? 'No stock alerts — everything is above its reorder level.' : 'No medicines yet.'}
          </p>
        ) : (
          medicines.map((entry) => (
            <div
              key={entry.medicine.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {entry.medicine.name}
                  {entry.medicine.strength ? ` ${entry.medicine.strength}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.medicine.code} · {entry.medicine.category} · {entry.batches.length} batch(es)
                  {entry.medicine.requiresPrescription ? ' · Rx only' : ' · OTC'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {entry.totalLiveStock} {entry.medicine.unit}
                </span>
                {entry.outOfStock ? (
                  <Badge variant="destructive">Out of stock</Badge>
                ) : entry.lowStock ? (
                  <Badge variant="warning">Low</Badge>
                ) : (
                  <Badge variant="success">In stock</Badge>
                )}
                {canManage ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(entry)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(entry.medicine.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MedicineForm({
  entry,
  onDone,
  onCancel,
}: {
  entry: MedicineWithStock | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: entry?.medicine.name ?? '',
    code: entry?.medicine.code ?? '',
    category: entry?.medicine.category ?? 'GENERAL',
    strength: entry?.medicine.strength ?? '',
    form: entry?.medicine.form ?? '',
    unit: entry?.medicine.unit ?? 'unit',
    reorderLevel: String(entry?.medicine.reorderLevel ?? 0),
    unitCost: String(entry?.medicine.unitCost ?? 0),
    requiresPrescription: entry?.medicine.requiresPrescription ?? true,
  });
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        category: form.category.trim() || 'GENERAL',
        strength: form.strength.trim() || undefined,
        form: form.form.trim() || undefined,
        unit: form.unit.trim() || 'unit',
        reorderLevel: Number(form.reorderLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        requiresPrescription: form.requiresPrescription,
      };
      if (entry) {
        const { updateMedicine } = await import('@/services/api/pharmacy');
        return updateMedicine(entry.medicine.id, payload);
      }
      return createMedicine(payload);
    },
    onSuccess: (saved) => onDone(`Medicine "${saved.name}" saved.`),
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That medicine could not be saved.'));
    },
  });

  const canSubmit = form.name.trim().length > 0 && form.code.trim().length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 p-4">
      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Name"
        />
        <Input
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
          placeholder="Code"
        />
        <Input
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder="Category"
        />
        <Input
          value={form.strength}
          onChange={(event) => setForm({ ...form, strength: event.target.value })}
          placeholder="Strength (e.g. 500mg)"
        />
        <Input
          value={form.form}
          onChange={(event) => setForm({ ...form, form: event.target.value })}
          placeholder="Form (tablet, vial)"
        />
        <Input
          value={form.unit}
          onChange={(event) => setForm({ ...form, unit: event.target.value })}
          placeholder="Unit"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.reorderLevel}
          onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })}
          placeholder="Reorder level"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.unitCost}
          onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
          placeholder="Unit cost"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.requiresPrescription}
          onChange={(event) => setForm({ ...form, requiresPrescription: event.target.checked })}
        />
        Prescription only — cannot be dispensed without a prescription order
      </label>
      <div className="flex gap-2">
        <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving...' : entry ? 'Save changes' : 'Add medicine'}
        </Button>
        {entry ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ================================ batches ================================

function useBatches() {
  return useQuery({
    queryKey: PHARMACY_KEYS.batches(),
    queryFn: () => listBatches(),
    staleTime: 30_000,
  });
}

function BatchRow({ batch }: { batch: StockBatch }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {batch.medicineName} <span className="text-muted-foreground">· {batch.batchNumber}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {batch.quantity} in stock · cost {batch.unitCost} · value {batch.stockValue.toFixed(2)}
          {batch.supplierName ? ` · ${batch.supplierName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline h-3 w-3" />
          {new Date(batch.expiryDate).toLocaleDateString()}
        </span>
        {batch.expired ? (
          <Badge variant="destructive">Expired</Badge>
        ) : batch.expiringSoon ? (
          <Badge variant="warning">Expiring soon</Badge>
        ) : (
          <Badge variant="outline">OK</Badge>
        )}
      </div>
    </div>
  );
}

function ReceiveStockForm() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((state) => state.hasPermission(PERMISSIONS.BATCH_MANAGE));
  const { data: medicines } = useMedicines('', '', false);
  const { data: suppliers } = useSuppliers();

  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    medicineId: '',
    supplierId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    unitCost: '',
    reference: '',
  });

  const receive = useMutation({
    mutationFn: () =>
      receiveStock({
        medicineId: form.medicineId,
        supplierId: form.supplierId || undefined,
        batchNumber: form.batchNumber.trim(),
        expiryDate: form.expiryDate,
        quantity: Number(form.quantity),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        reference: form.reference.trim() || undefined,
      }),
    onSuccess: (movement) => {
      setStatus('success');
      setMessage(
        `Received ${movement.quantity} — batch balance is now ${movement.balanceAfter}.`,
      );
      setForm({ ...form, batchNumber: '', quantity: '', reference: '' });
      void queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That delivery could not be recorded.'));
    },
  });

  const canSubmit =
    form.medicineId.length > 0 &&
    form.batchNumber.trim().length > 0 &&
    form.expiryDate.length > 0 &&
    Number(form.quantity) > 0;

  if (!canWrite) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4" /> Receive stock
        </CardTitle>
        <CardDescription>
          Re-delivering an existing batch number tops that batch up instead of creating a duplicate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={5000} />
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={form.medicineId}
            onChange={(event) => setForm({ ...form, medicineId: event.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a medicine</option>
            {(medicines?.content ?? []).map((entry) => (
              <option key={entry.medicine.id} value={entry.medicine.id}>
                {entry.medicine.name} ({entry.medicine.code})
              </option>
            ))}
          </select>
          <select
            value={form.supplierId}
            onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">No supplier recorded</option>
            {(suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <Input
            value={form.batchNumber}
            onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}
            placeholder="Batch number"
          />
          <Input
            type="date"
            value={form.expiryDate}
            onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
            aria-label="Expiry date"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.quantity}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            placeholder="Quantity"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.unitCost}
            onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
            placeholder="Unit cost"
          />
          <Input
            value={form.reference}
            onChange={(event) => setForm({ ...form, reference: event.target.value })}
            placeholder="Delivery note (optional)"
          />
        </div>
        <Button disabled={!canSubmit || receive.isPending} onClick={() => receive.mutate()}>
          <ArrowUpCircle className="h-4 w-4" />
          {receive.isPending ? 'Recording...' : 'Record receipt'}
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================== movements ===============================

function useMovements() {
  return useQuery({
    queryKey: PHARMACY_KEYS.movements(),
    queryFn: () => listMovements(),
    staleTime: 30_000,
  });
}

function StockMovementLedger() {
  const canMove = useAuthStore((state) => state.hasPermission(PERMISSIONS.BATCH_MANAGE));
  const { data, isLoading } = useMovements();
  const movements = data?.content ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="h-4 w-4" /> Stock movement ledger
        </CardTitle>
        <CardDescription>
          Append-only. A mistake is corrected with another movement, never an edit — the database
          rejects updates and deletes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {canMove ? <MovementForm /> : null}
        {isLoading ? (
          <Skeleton className="h-14 w-full rounded-2xl" />
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
        ) : (
          movements.map((movement) => (
            <div
              key={movement.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {movement.medicineName}
                  {movement.batchNumber ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {movement.batchNumber}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {movement.quantity} · balance {movement.balanceAfter} ·{' '}
                  {new Date(movement.performedAt).toLocaleString()}
                  {movement.performedByName ? ` · ${movement.performedByName}` : ''}
                  {movement.reason ? ` · ${movement.reason}` : ''}
                </p>
              </div>
              <Badge variant={MOVEMENT_VARIANT[movement.kind]}>{movement.kind}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MovementForm() {
  const queryClient = useQueryClient();
  const { data } = useBatches();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    batchId: '',
    kind: 'DISPENSED' as MovementKind,
    quantity: '',
    prescriptionOrderId: '',
    reason: '',
  });

  const usable = (data?.content ?? []).filter((batch) => !batch.expired && batch.quantity > 0);

  const record = useMutation({
    mutationFn: () =>
      recordMovement({
        batchId: form.batchId,
        kind: form.kind,
        // A negative adjustment means "reduce"; the server reads the sign.
        quantity: Number(form.quantity),
        prescriptionOrderId: form.prescriptionOrderId.trim() || undefined,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: (movement) => {
      setStatus('success');
      setMessage(
        `${movement.kind} recorded — batch balance is now ${movement.balanceAfter}.`,
      );
      setForm({ ...form, quantity: '', reason: '' });
      void queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That movement could not be recorded.'));
    },
  });

  const canSubmit = form.batchId.length > 0 && Number(form.quantity) !== 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 p-4">
      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={5000} />
      <div className="grid gap-3 md:grid-cols-4">
        <select
          value={form.batchId}
          onChange={(event) => setForm({ ...form, batchId: event.target.value })}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a batch</option>
          {usable.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.medicineName} · {batch.batchNumber} ({batch.quantity})
            </option>
          ))}
        </select>
        <select
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value as MovementKind })}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          {(['DISPENSED', 'RETURNED', 'DAMAGED', 'EXPIRED', 'ADJUSTED'] as MovementKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <Input
          type="number"
          step="0.01"
          value={form.quantity}
          onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          placeholder="Quantity (negative to reduce)"
        />
        <Input
          value={form.reason}
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
          placeholder="Reason"
        />
      </div>
      {form.kind === 'DISPENSED' ? (
        <Input
          value={form.prescriptionOrderId}
          onChange={(event) => setForm({ ...form, prescriptionOrderId: event.target.value })}
          placeholder="Prescription order ID (required for prescription-only medicines)"
        />
      ) : null}
      <Button disabled={!canSubmit || record.isPending} onClick={() => record.mutate()}>
        {record.isPending ? 'Recording...' : 'Record movement'}
      </Button>
    </div>
  );
}

// ================================ alerts =================================

function useAlerts() {
  return useQuery({
    queryKey: PHARMACY_KEYS.alerts(),
    queryFn: fetchAlerts,
    staleTime: 30_000,
  });
}

function useSummary() {
  return useQuery({
    queryKey: PHARMACY_KEYS.summary(),
    queryFn: () => fetchPharmacySummary(),
    staleTime: 30_000,
  });
}

function useCategories() {
  return useQuery({
    queryKey: PHARMACY_KEYS.categories(),
    queryFn: listCategories,
    staleTime: 300_000,
  });
}

function useSuppliers() {
  return useQuery({
    queryKey: PHARMACY_KEYS.suppliers(),
    queryFn: listSuppliers,
    staleTime: 300_000,
  });
}

function AlertPanels() {
  const { data, isLoading } = useAlerts();
  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }
  if (!data) return null;

  const sections = [
    {
      title: 'Out of stock',
      tone: 'destructive' as const,
      items: data.outOfStock.map((medicine) => `${medicine.name} (${medicine.code})`),
      empty: 'Every active medicine has usable stock.',
    },
    {
      title: 'Low stock',
      tone: 'warning' as const,
      items: data.lowStock.map((medicine) => `${medicine.name} — reorder at ${medicine.reorderLevel}`),
      empty: 'Nothing is below its reorder level.',
    },
    {
      title: 'Expiring soon',
      tone: 'warning' as const,
      items: data.expiringSoon.map(
        (batch) => `${batch.medicineName} ${batch.batchNumber} — ${new Date(batch.expiryDate).toLocaleDateString()}`
      ),
      empty: 'No lots are approaching expiry.',
    },
    {
      title: 'Expired — write off',
      tone: 'destructive' as const,
      items: data.expired.map(
        (batch) => `${batch.medicineName} ${batch.batchNumber} — ${batch.quantity} still on shelf`
      ),
      empty: 'No expired stock.',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.18em]">
              {section.title}
            </CardDescription>
            <CardTitle className="text-2xl">{section.items.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {section.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{section.empty}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {section.items.slice(0, 5).map((item) => (
                  <li key={item} className="truncate">
                    {item}
                  </li>
                ))}
                {section.items.length > 5 ? (
                  <li className="text-muted-foreground">+{section.items.length - 5} more</li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
  money,
}: {
  label: string;
  value: number;
  icon: typeof Boxes;
  loading?: boolean;
  money?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl">
          {loading ? '...' : money ? value.toFixed(2) : value}
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}