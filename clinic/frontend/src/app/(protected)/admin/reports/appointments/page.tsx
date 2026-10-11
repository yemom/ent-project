'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, CalendarCheck, Clock, UserCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { listAppointments, type AppointmentItem } from '@/services/api/appointments';
import { useHospitalStats } from '@/features/admin/use-hospital-stats';

export default function AppointmentsReportPage() {
  const { data: stats } = useHospitalStats();
  const { data: apptsPage, isLoading } = useQuery({
    queryKey: ['appointments', { page: 0, size: 50 }],
    queryFn: () => listAppointments({ page: 0, size: 50 }),
  });

  const appointments: AppointmentItem[] = apptsPage?.content || [];
  const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
  const scheduled = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING').length;
  const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments Report"
        description="Comprehensive scheduling metrics, volume analysis, and operational load."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Appointments Today</CardDescription>
            <CardTitle className="text-3xl">
              {stats?.appointmentsToday ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Today's active clinical queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Scheduled / Active</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {isLoading ? '...' : scheduled}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Confirmed bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Completed</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {isLoading ? '...' : completed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Successfully fulfilled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Cancelled</CardDescription>
            <CardTitle className="text-3xl text-rose-600">
              {isLoading ? '...' : cancelled}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Cancelled by patient or clinic</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Appointments</CardTitle>
          <CardDescription>Live appointment records retrieved from database.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointment records found in database.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.slice(0, 15).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {new Date(a.scheduledAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{a.patientName || 'Patient'}</TableCell>
                    <TableCell>{a.doctorName || 'Doctor'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{a.reason || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.status === 'COMPLETED'
                            ? 'default'
                            : a.status === 'CANCELLED'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {a.status}
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
