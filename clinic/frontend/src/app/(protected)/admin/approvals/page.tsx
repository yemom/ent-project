'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, X, ShieldAlert, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { StatusAlert, type StatusType } from '@/components/shared/status-alert';
import { listRoleChangeRequests, approveRoleChange, rejectRoleChange, type RoleChangeRequest } from '@/services/api/admin';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('PENDING');
  const [reason, setReason] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [message, setMessage] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'role-requests', filter],
    queryFn: () => listRoleChangeRequests({ status: filter || undefined }),
    staleTime: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => approveRoleChange(id, reason),
    onSuccess: () => {
      setStatus('success');
      setMessage('Role change request approved successfully.');
      setSelectedId(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'role-requests'] });
    },
    onError: (err) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(err, 'Failed to approve request.'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectRoleChange(id, reason),
    onSuccess: () => {
      setStatus('success');
      setMessage('Role change request rejected.');
      setSelectedId(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'role-requests'] });
    },
    onError: (err) => {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(err, 'Failed to reject request.'));
    },
  });

  const requests: RoleChangeRequest[] = data?.content || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Dual-control authorization queue for privileged role changes and sensitive operations."
      />

      <StatusAlert status={status} message={message} onDismiss={() => setStatus(null)} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
            <Button
              key={s || 'ALL'}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s || 'All Requests'}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Change Requests</CardTitle>
          <CardDescription>
            High-privilege role modifications require explicit approval from an independent Super Admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{getFriendlyErrorMessage(error, 'Could not load requests.')}</p>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No {filter.toLowerCase()} role change requests found in the system.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Target Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.targetUserId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{req.targetRole}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{req.reason || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(req.requestedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === 'APPROVED' ? 'default' : req.status === 'REJECTED' ? 'destructive' : 'secondary'
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate({ id: req.id, reason: 'Approved by Super Admin' })}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate({ id: req.id, reason: 'Rejected by Super Admin' })}
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
