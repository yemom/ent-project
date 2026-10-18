'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  Building2,
  ClipboardList,
  DoorOpen,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { PageHeader } from '@/components/layouts/page-header';
import { listDoctors, listStaffDirectory, listUsers } from '@/services/api/users';
import {
  HOSPITAL_KEYS,
  createDepartment,
  createRoom,
  createWard,
  deleteDepartment,
  deleteRoom,
  deleteWard,
  listAdmissions,
  listDepartments,
  listOpenAdmissions,
  listRooms,
  listWards,
  updateDepartment,
  updateRoom,
  updateWard,
  type Department,
  type Room,
  type Ward,
} from '@/services/api/hospital';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { useAuthStore } from '@/store/auth-store';
import { useHospitalStats } from '@/features/admin/use-hospital-stats';
import { PERMISSIONS } from '@/features/auth/permissions';

/**
 * Hospital operations.
 *
 * <p>Departments, wards and rooms are real records with their own endpoints; the
 * writes are gated by `department:manage`, `ward:manage` and `room:manage`, which
 * only HOSPITAL_ADMIN holds. Buttons are hidden rather than shown-then-refused so
 * the screen matches what the API will actually allow.
 */

const ROOM_STATUS_VARIANT: Record<Room['status'], 'success' | 'warning' | 'outline'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'warning',
  MAINTENANCE: 'outline',
};

function useDoctors() {
  return useQuery({
    queryKey: ['doctors', { size: 100 }],
    queryFn: () => listDoctors({ size: 100 }),
    staleTime: 60_000,
  });
}

function useHospitalsStats() {
  // Disabled unless the role holds `report:read`, so a request that would 403 is
  // never sent. HOSPITAL_ADMIN holds it.
  return useHospitalStats();
}

// =============================== departments ===============================

function useDepartments() {
  return useQuery({
    queryKey: HOSPITAL_KEYS.departments,
    queryFn: listDepartments,
    staleTime: 60_000,
  });
}

export function HospitalDepartmentsPage() {
  const { data: departments, isLoading } = useDepartments();
  const { data: doctors } = useDoctors();
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.hasPermission(PERMISSIONS.DEPARTMENT_MANAGE));

  const [editing, setEditing] = useState<Department | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: HOSPITAL_KEYS.departments });

  const remove = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      setStatus('success');
      setMessage('Department deleted.');
      void invalidate();
    },
    onError: (error) => {
      // The API refuses to delete a department that still has wards; surface
      // that rather than a generic failure.
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That department could not be deleted.'));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Clinical departments, their heads and the wards they own."
      />

      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />

      {canManage ? (
        <DepartmentForm
          key={editing?.id ?? 'new'}
          department={editing}
          doctors={doctors?.content ?? []}
          onDone={(text) => {
            setEditing(null);
            setStatus('success');
            setMessage(text);
            void invalidate();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Departments
          </CardTitle>
          <CardDescription>{departments?.length ?? 0} active department(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </>
          ) : !departments?.length ? (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          ) : (
            departments.map((department) => (
              <div
                key={department.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{department.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {department.code}
                    {department.description ? ` · ${department.description}` : ''}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(department)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(department.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DepartmentForm({
  department,
  doctors,
  onDone,
  onCancel,
}: {
  department: Department | null;
  doctors: Array<{ id: string; fullName: string; specialization?: string }>;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: department?.name ?? '',
    code: department?.code ?? '',
    description: department?.description ?? '',
    headDoctorId: department?.headDoctorId ?? '',
  });
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        headDoctorId: form.headDoctorId || undefined,
      };
      return department
        ? updateDepartment(department.id, payload)
        : createDepartment(payload);
    },
    onSuccess: (saved) => onDone(`Department "${saved.name}" saved.`),
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That department could not be saved.'));
    },
  });

  const canSubmit = form.name.trim().length > 0 && form.code.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" /> {department ? 'Edit department' : 'New department'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Name"
          />
          <Input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            placeholder="Code (e.g. CARD)"
          />
        </div>
        <Input
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Description (optional)"
        />
        <select
          value={form.headDoctorId}
          onChange={(event) => setForm({ ...form, headDoctorId: event.target.value })}
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">No head of department</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.fullName}
              {doctor.specialization ? ` — ${doctor.specialization}` : ''}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save department'}
          </Button>
          {department ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ================================== wards ==================================

function useWards() {
  return useQuery({
    queryKey: HOSPITAL_KEYS.wards(),
    queryFn: () => listWards({ size: 50 }),
    staleTime: 60_000,
  });
}

export function HospitalWardsPage() {
  const { data: wards, isLoading } = useWards();
  const { data: rooms } = useRooms();
  const { data: departments } = useDepartments();
  const { data: admissions } = useOpenAdmissions();
  const queryClient = useQueryClient();
  const canManageWards = useAuthStore((state) => state.hasPermission(PERMISSIONS.WARD_MANAGE));
  const canManageRooms = useAuthStore((state) => state.hasPermission(PERMISSIONS.ROOM_MANAGE));

  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['hospital'] });
  };

  const removeWard = useMutation({
    mutationFn: deleteWard,
    onSuccess: () => {
      setStatus('success');
      setMessage('Ward deleted.');
      invalidate();
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That ward could not be deleted.'));
    },
  });

  const removeRoom = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      setStatus('success');
      setMessage('Room deleted.');
      invalidate();
    },
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That room could not be deleted.'));
    },
  });

  const bedsUsed = admissions?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wards & Rooms"
        description="Bed allocation, room status and who is currently admitted."
      />

      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Wards" value={wards?.totalElements ?? 0} icon={ClipboardList} loading={isLoading} />
        <Metric label="Rooms" value={rooms?.totalElements ?? 0} icon={DoorOpen} />
        <Metric label="Beds occupied" value={bedsUsed} icon={BedDouble} />
      </div>

      {canManageWards ? (
        <WardForm
          key={editingWard?.id ?? 'new-ward'}
          ward={editingWard}
          departments={departments ?? []}
          onDone={(text) => {
            setEditingWard(null);
            setStatus('success');
            setMessage(text);
            invalidate();
          }}
          onCancel={() => setEditingWard(null)}
        />
      ) : null}

      {canManageRooms ? (
        <RoomForm
          key={editingRoom?.id ?? 'new-room'}
          room={editingRoom}
          wards={wards?.content ?? []}
          onDone={(text) => {
            setEditingRoom(null);
            setStatus('success');
            setMessage(text);
            invalidate();
          }}
          onCancel={() => setEditingRoom(null)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Wards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-2xl" />
          ) : wards?.content.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wards yet.</p>
          ) : (
            wards?.content.map((ward) => (
              <div
                key={ward.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{ward.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {ward.departmentName} · {ward.code}
                    {ward.floor ? ` · ${ward.floor}` : ''} · capacity {ward.capacity}
                  </p>
                </div>
                {canManageWards ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingWard(ward)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeWard.isPending}
                      onClick={() => removeWard.mutate(ward.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4" /> Rooms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rooms?.content.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms yet.</p>
          ) : (
            rooms?.content.map((room) => (
              <div
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {room.wardName} · {room.departmentName} · {room.roomType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ROOM_STATUS_VARIANT[room.status]}>{room.status}</Badge>
                  {canManageRooms ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditingRoom(room)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removeRoom.isPending}
                        onClick={() => removeRoom.mutate(room.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BedDouble className="h-4 w-4" /> Currently admitted
          </CardTitle>
          <CardDescription>Live beds board, straight from the admission records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {admissions?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients are currently admitted.</p>
          ) : (
            admissions?.map((admission) => (
              <div
                key={admission.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4"
              >
                <div>
                  <p className="font-medium">{admission.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {[admission.wardName, admission.roomName].filter(Boolean).join(' · ') || 'No bed assigned'}
                    {admission.doctorName ? ` · ${admission.doctorName}` : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Admitted {new Date(admission.admittedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function useRooms() {
  return useQuery({
    queryKey: HOSPITAL_KEYS.rooms(),
    queryFn: () => listRooms({ size: 50 }),
    staleTime: 60_000,
  });
}

function useOpenAdmissions() {
  return useQuery({
    queryKey: HOSPITAL_KEYS.admissions('ADMITTED'),
    queryFn: listOpenAdmissions,
    staleTime: 60_000,
  });
}

function WardForm({
  ward,
  departments,
  onDone,
  onCancel,
}: {
  ward: Ward | null;
  departments: Department[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    departmentId: ward?.departmentId ?? departments[0]?.id ?? '',
    name: ward?.name ?? '',
    code: ward?.code ?? '',
    floor: ward?.floor ?? '',
    capacity: String(ward?.capacity ?? 1),
  });
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        departmentId: form.departmentId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        floor: form.floor.trim() || undefined,
        capacity: Number(form.capacity) || 1,
      };
      return ward ? updateWard(ward.id, payload) : createWard(payload);
    },
    onSuccess: (saved) => onDone(`Ward "${saved.name}" saved.`),
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That ward could not be saved.'));
    },
  });

  const canSubmit =
    form.departmentId.length > 0 && form.name.trim().length > 0 && form.code.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ward ? 'Edit ward' : 'New ward'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={form.departmentId}
            onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ward name"
          />
          <Input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            placeholder="Code"
          />
          <Input
            value={form.floor}
            onChange={(event) => setForm({ ...form, floor: event.target.value })}
            placeholder="Floor (optional)"
          />
          <Input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            placeholder="Capacity"
          />
        </div>
        <div className="flex gap-2">
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save ward'}
          </Button>
          {ward ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function RoomForm({
  room,
  wards,
  onDone,
  onCancel,
}: {
  room: Room | null;
  wards: Ward[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    wardId: room?.wardId ?? wards[0]?.id ?? '',
    name: room?.name ?? '',
    roomType: room?.roomType ?? 'GENERAL',
    capacity: String(room?.capacity ?? 1),
    status: room?.status ?? 'AVAILABLE',
  });
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        wardId: form.wardId,
        name: form.name.trim(),
        roomType: form.roomType,
        capacity: Number(form.capacity) || 1,
        status: form.status as Room['status'],
      };
      return room ? updateRoom(room.id, payload) : createRoom(payload);
    },
    onSuccess: (saved) => onDone(`Room "${saved.name}" saved.`),
    onError: (error) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'That room could not be saved.'));
    },
  });

  const canSubmit = form.wardId.length > 0 && form.name.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{room ? 'Edit room' : 'New room'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} autoDismissMs={4000} />
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={form.wardId}
            onChange={(event) => setForm({ ...form, wardId: event.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a ward</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name} — {ward.departmentName}
              </option>
            ))}
          </select>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Room name / number"
          />
          <select
            value={form.roomType}
            onChange={(event) => setForm({ ...form, roomType: event.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {['GENERAL', 'PRIVATE', 'ICU', 'MATERNITY', 'PAEDIATRIC', 'ISOLATION'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as Room['status'] })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            placeholder="Capacity"
          />
        </div>
        <div className="flex gap-2">
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save room'}
          </Button>
          {room ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ================================ dashboard =================================

export function HospitalDashboardPage() {
  const stats = useHospitalsStats();
  const { data: departments } = useDepartments();
  const { data: wards } = useWards();
  const { data: rooms } = useRooms();
  const { data: admissions } = useOpenAdmissions();

  const doctorCount = stats.data?.totalDoctors ?? 0;
  const nurseCount = stats.data?.totalNurses ?? 0;
  const availableRooms = stats.data?.roomsAvailable ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hospital Operations"
        description="Departments, staff, wards and beds — no clinical data."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Doctors" value={doctorCount} icon={Stethoscope} loading={stats.isLoading} />
        <Metric label="Nurses" value={nurseCount} icon={Users} loading={stats.isLoading} />
        <Metric label="Beds available" value={availableRooms} icon={BedDouble} loading={stats.isLoading} />
        <Metric label="Admitted" value={admissions?.length ?? 0} icon={ClipboardList} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Departments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {departments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments yet.</p>
            ) : (
              departments?.slice(0, 6).map((department) => (
                <div key={department.id} className="flex items-center justify-between py-1 text-sm">
                  <span>{department.name}</span>
                  <span className="text-muted-foreground">{department.code}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DoorOpen className="h-4 w-4" /> Wards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {wards?.content.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wards yet.</p>
            ) : (
              wards?.content.slice(0, 6).map((ward) => (
                <div key={ward.id} className="flex items-center justify-between py-1 text-sm">
                  <span>{ward.name}</span>
                  <span className="text-muted-foreground">{ward.departmentName}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Can manage departments, staff, wards and rooms, and read operational reports
            ({rooms?.totalElements ?? 0} rooms across {wards?.totalElements ?? 0} wards).
          </p>
          <p>
            Cannot read diagnoses, treatment plans or prescriptions — the API rejects those requests with
            403.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ================================== staff ===================================

/**
 * Staff for the hospital administrator's directory.
 *
 * <p>A hospital administrator holds `staff:manage` but not `user:manage`, so
 * `/admin/users` answers 403 for them. Asking for it unconditionally put a red 403
 * in the console on every hospital page; the query now picks the directory the
 * caller's role is actually allowed to read.
 */
function useStaff() {
  const canReadAccounts = useAuthStore((state) => state.hasPermission(PERMISSIONS.USER_MANAGE));

  return useQuery({
    queryKey: ['users', { size: 100 }],
    queryFn: () => (canReadAccounts ? listUsers({ size: 100 }) : listStaffDirectory({ size: 100 })),
    staleTime: 60_000,
  });
}

export function HospitalStaffPage() {
  const staff = useStaff();
  const rows = useMemo(() => staff.data?.content ?? [], [staff.data]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.fullName, row.email, row.role].some((value) => (value ?? '').toLowerCase().includes(q))
    );
  }, [query, rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Hospital staff directory." />
      <Card>
        <CardContent className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search staff..."
          />
          {staff.isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff found.</p>
          ) : (
            filtered.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                </div>
                <Badge variant="outline">{row.role}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================================= reports ==================================

export function HospitalReportsPage() {
  const staff = useStaff();
  const stats = useHospitalsStats();
  const rooms = useRooms();
  const { data: admissions } = useOpenAdmissions();

  const error = staff.error ?? stats.error ?? rooms.error;
  const doctors = stats.data?.totalDoctors ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Operational counts. No clinical data." />
      {error ? (
        <Card>
          <CardContent className="text-sm text-destructive">
            {getFriendlyErrorMessage(error, 'Reports could not be loaded.')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Metric label="Total staff" value={staff.data?.totalElements ?? 0} icon={Users} loading={staff.isLoading} />
          <Metric label="Active providers" value={doctors} icon={Stethoscope} loading={stats.isLoading} />
          <Metric
            label="Rooms"
            value={rooms.data?.totalElements ?? 0}
            icon={DoorOpen}
            loading={rooms.isLoading}
          />
          <Metric
            label="Rooms available"
            value={stats.data?.roomsAvailable ?? 0}
            icon={BedDouble}
            loading={stats.isLoading}
          />
          <Metric label="Currently admitted" value={admissions?.length ?? 0} icon={ClipboardList} />
          <Metric
            label="Appointments today"
            value={stats.data?.appointmentsToday ?? 0}
            icon={ClipboardList}
            loading={stats.isLoading}
          />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.18em]">{label}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl">
          {loading ? '...' : value}
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}