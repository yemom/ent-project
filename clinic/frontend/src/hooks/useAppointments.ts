'use client';

import { useEffect, useState } from 'react';
import { listAppointments } from '@/services/api/appointments';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { useAuthStore } from '@/store/auth-store';
import type { Appointment } from '@/types/api';

export function useAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        async function fetchAppointments() {
            try {
                setIsLoading(true);

                const params: Record<string, string> = {};
                if (user?.role === 'DOCTOR') params.doctorId = user.id;
                if (user?.role === 'PATIENT') params.patientId = user.id;

                const data = await listAppointments(params);

                // Normalize backend records into the shape used by the UI cards and tables.
                const mapped: Appointment[] = (data.content ?? []).map((appointment: any) => ({
                    id: appointment.id,
                    patient: {
                        id: appointment.patient?.id || appointment.patientId || '1',
                        fullName: appointment.patient?.fullName || appointment.patientName || 'Unknown Patient'
                    },
                    doctor: {
                        id: appointment.doctor?.id || appointment.doctorId || '1',
                        fullName: appointment.doctor?.fullName || appointment.doctorName || 'Unknown Doctor'
                    },
                    time: new Date(appointment.appointmentDate || appointment.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: appointment.status,
                    type: appointment.reasonForVisit || appointment.reason || 'General'
                }));

                setAppointments(mapped);
                setError(null);
            } catch (err) {
                setError(getFriendlyErrorMessage(err, 'We could not load appointments right now. Please try again in a moment.'));
            } finally {
                setIsLoading(false);
            }
        }

        fetchAppointments();
    }, [user?.id, user?.role]);

    return { appointments, isLoading, error };
}