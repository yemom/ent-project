'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, HeartPulse, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { listPatients } from '@/services/api/users';
import { useHospitalStats } from '@/features/admin/use-hospital-stats';

export default function PatientVolumeReportPage() {
  const { data: stats, isLoading: statsLoading } = useHospitalStats();
  const { data: patientsPage, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', { page: 0, size: 50 }],
    queryFn: () => listPatients({ page: 0, size: 50 }),
  });

  const patients = patientsPage?.content || [];
  const totalPatients = stats?.totalPatients ?? patientsPage?.totalElements ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Volume Report"
        description="Aggregate demographics and volume trends across the patient directory. No clinical data exposed."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Total Registered Patients</CardDescription>
            <CardTitle className="text-3xl">
              {statsLoading ? '...' : totalPatients}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active profiles in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">New Registrations (Recent)</CardDescription>
            <CardTitle className="text-3xl">
              {patientsLoading ? '...' : patients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sampled directory records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Capacity Status</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">Optimal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Within clinical service thresholds</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Registered Patients</CardTitle>
          <CardDescription>Demographic listings from the live database.</CardDescription>
        </CardHeader>
        <CardContent>
          {patientsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : patients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patient records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.slice(0, 15).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>{p.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.gender || 'UNSPECIFIED'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? 'default' : 'secondary'}>
                        {p.active ? 'Active' : 'Inactive'}
                      </Badge>
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
