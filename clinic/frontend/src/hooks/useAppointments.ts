'use client';
import { useState, useEffect } from 'react';
import { listAppointments } from '@/services/api/appointments';
import { useAuthStore } from '@/store/auth-store';
import type { Appointment } from '@/types/api';

export function useAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore(s => s.user);

    useEffect(() => {
        async function fetchAppointments() {
            try {
                setIsLoading(true);
                const params: any = {};
                if (user?.role === 'DOCTOR') params.doctorId = user.id;
                if (user?.role === 'PATIENT') params.patientId = user.id;
                
                const data = await listAppointments(params);
                // Map AppointmentItem to Appointment
                const mapped: Appointment[] = (data.content ?? []).map((a: any) => ({
                    id: a.id,
                    patient: { 
                        id: a.patient?.id || a.patientId || '1', 
                        fullName: a.patient?.fullName || a.patientName || 'Unknown Patient' 
                    },
                    doctor: { 
                        id: a.doctor?.id || a.doctorId || '1', 
                        fullName: a.doctor?.fullName || a.doctorName || 'Unknown Doctor' 
                    },
                    time: new Date(a.appointmentDate || a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: a.status,
                    type: a.reasonForVisit || a.reason || 'General'
                }));
                setAppointments(mapped);
                setError(null);
            } catch (err) {
                setError('Failed to load appointments');
            } finally {
                setIsLoading(false);
            }
        }

        fetchAppointments();
    }, []); // runs once when the component mounts

    return { appointments, isLoading, error };
}