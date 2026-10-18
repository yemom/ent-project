'use client';

import { useEffect, useState } from 'react';
import { listAppointments } from '@/services/api/appointments';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { useAuthStore } from '@/store/auth-store';
import type { Appointment } from '@/types/api';

/**
 * The doctor's own panel, in the display shape the schedule tables use.
 *
 * <p>Kept as a plain `useState` hook rather than a query hook because the caller is
 * a doctor dashboard that re-fetches when the signed-in user changes, and because
 * it has to survive the session store rehydrating after a full page load — the
 * effect waits for `isHydrated` before it asks for anything.
 *
 * <p>The mapping reads the real `AppointmentResponse` shape. It used to also accept
 * `patientName` / `doctorName` / `scheduledAt` fallbacks for a response shape the
 * API never had, which made a genuine field rename look like a supported variant
 * rather than the bug it was.
 */
export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!isHydrated || !accessToken || !user?.id) return;

    let cancelled = false;

    async function fetchAppointments() {
      try {
        setIsLoading(true);

        // The server already scopes a doctor to their own panel and a patient to
        // their own appointments, so these filters are belt-and-braces: they keep
        // the request small and make the intent readable at the call site.
        const params: Record<string, string> = {};
        if (user?.role === 'DOCTOR') params.doctorId = user.id;
        if (user?.role === 'PATIENT') params.patientId = user.id;

        const data = await listAppointments(params);
        if (cancelled) return;

        const mapped: Appointment[] = (data.content ?? []).map((appointment) => ({
          id: appointment.id,
          patient: {
            id: appointment.patient?.id ?? '',
            fullName: appointment.patient?.fullName ?? 'Unknown Patient',
          },
          doctor: {
            id: appointment.doctor?.id ?? '',
            fullName: appointment.doctor?.fullName ?? 'Unknown Doctor',
          },
          time: new Date(appointment.appointmentDate).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: appointment.status,
          type: (appointment.reasonForVisit ?? 'General') as Appointment['type'],
        }));

        setAppointments(mapped);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          getFriendlyErrorMessage(
            err,
            'We could not load appointments right now. Please try again in a moment.',
          ),
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchAppointments();
    return () => {
      // Without this, switching accounts mid-flight resolves the previous user's
      // request into the new user's state.
      cancelled = true;
    };
  }, [user?.id, user?.role, isHydrated, accessToken]);

  return { appointments, isLoading, error };
}