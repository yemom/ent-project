'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Phone, Mail, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layouts/page-header';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  type Branch,
  type BranchPayload,
} from '@/services/api/branches';

const EMPTY_FORM: BranchPayload = {
  name: '',
  code: '',
  type: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
  active: true,
};

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchPayload>(EMPTY_FORM);

  const { data, isLoading, error } = useQuery({
    queryKey: ['branches'],
    queryFn: () => listBranches({ size: 100 }),
    staleTime: 30_000,
  });

  const branches = data?.content ?? [];

  const openCreate = () => {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      type: branch.type ?? '',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      notes: branch.notes ?? '',
      active: branch.active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBranch(null);
    setForm(EMPTY_FORM);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editingBranch) {
        return updateBranch(editingBranch.id, form);
      }
      return createBranch(form);
    },
    onSuccess: (saved) => {
      setStatus('success');
      setMessage(`Branch "${saved.name}" ${editingBranch ? 'updated' : 'created'} successfully.`);
      closeForm();
      void queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(err, 'Could not save branch.'));
    },
  });

  const remove = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => {
      setStatus('success');
      setMessage('Branch deleted.');
      void queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(err, 'Could not delete branch.'));
    },
  });

  const handleDelete = (branch: Branch) => {
    if (!confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) return;
    remove.mutate(branch.id);
  };

  const canSubmit = form.name.trim().length > 0 && form.code.trim().length > 0;

  const activeCount = branches.filter((b) => b.active).length;
  const inactiveCount = branches.length - activeCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Multi-branch hospital facility management."
        actionLabel="Add Branch"
        onAction={openCreate}
      />

      <StatusAlert
        status={status ?? (error ? 'error' : null)}
        message={message || (error ? getFriendlyErrorMessage(error, 'Could not load branches.') : '')}
        onDismiss={() => setStatus(null)}
        autoDismiss
        autoDismissMs={4000}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Total Branches</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '...' : branches.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{isLoading ? '...' : activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Inactive</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{isLoading ? '...' : inactiveCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{editingBranch ? `Edit: ${editingBranch.name}` : 'Add New Branch'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Branch Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Main Campus"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Branch Code *</label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="MAIN-01"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <Input
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    placeholder="Inpatient & Trauma Center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+251 911 000 000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    type="email"
                    placeholder="branch@clinic.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="100 Medical Center Blvd"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional information"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active ?? true}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4"
                />
                Active branch
              </label>
              <div className="flex gap-2">
                <Button
                  disabled={!canSubmit || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Saving...' : editingBranch ? 'Save Changes' : 'Create Branch'}
                </Button>
                <Button variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branch cards */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No branches yet</p>
              <p className="text-sm text-muted-foreground">Click &quot;Add Branch&quot; to register the first facility.</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Branch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {branches.map((branch) => (
            <Card key={branch.id} className={`relative overflow-hidden border ${branch.active ? '' : 'opacity-70'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{branch.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">{branch.code}</Badge>
                    </div>
                    {branch.type && <CardDescription className="mt-1">{branch.type}</CardDescription>}
                  </div>
                  <Badge
                    variant={branch.active ? 'default' : 'secondary'}
                    className={branch.active ? 'bg-emerald-600' : ''}
                  >
                    {branch.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  {branch.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>{branch.email}</span>
                    </div>
                  )}
                  {branch.notes && (
                    <p className="text-xs italic">{branch.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(branch)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => handleDelete(branch)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
