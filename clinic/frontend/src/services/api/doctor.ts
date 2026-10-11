import { apiClient } from '@/services/api/client';
import { listAppointments } from '@/services/api/appointments';
import { listMedicalRecords } from '@/services/api/medical-records';
import { listPrescriptionOrdersByDoctor } from '@/features/prescriptions/services/prescription-orders';
import { useAuthStore } from '@/store/auth-store';
import type { Appointment, Prescription, DoctorStats } from '@/types/api';

/**
 * Today's appointments for the signed-in doctor.
 *
 * <p>Derived from `GET /appointments?doctorId=...`, filtered to today. There is no
 * `/doctor/appointments/today` route on the server, so that call could only ever
 * 404 before the fallback ran. See {@link getDoctorStats} for the same reasoning.
 */
export async function getTodayAppointments(): Promise<Appointment[]> {
    const user = useAuthStore.getState().user;
    const doctorId = user?.id;

    if (!doctorId) return [];

    const res = await listAppointments({ doctorId, size: 50 });
    const todayStr = new Date().toISOString().slice(0, 10);

    return (res.content ?? [])
        .filter((item: any) => {
            const date = (item.appointmentDate || item.scheduledAt || '').slice(0, 10);
            return date === todayStr;
        })
        .map((item: any) => ({
            id: item.id,
            time: item.scheduledAt || item.appointmentDate || '',
            patient: {
                id: item.patient?.id || item.patientId || '',
                fullName: item.patient?.fullName || item.patientName || 'Unknown Patient',
            },
            status: item.status || 'CONFIRMED',
            type: item.reasonForVisit || item.reason || 'CHECKUP',
        }));
}

/**
 * Doctor dashboard stats, aggregated from real database records.
 *
 * <p>Computed client-side from three list endpoints that all exist.
 *
 * <p>An earlier version tried `GET /doctor/stats` first. No such route exists on the
 * server -- the only stats endpoint is `/api/v1/stats/hospital` -- so that call
 * could only ever 404, and its `catch` then fired three more requests to compute the
 * same numbers. Every dashboard load therefore produced a guaranteed 404 plus a
 * burst of follow-up traffic, which made the console look like the API was failing.
 *
 * <p>No speculative call: if a dedicated route is ever added, it can be introduced
 * here deliberately, with the aggregation kept as the fallback.
 */
export async function getDoctorStats(): Promise<DoctorStats> {
    const user = useAuthStore.getState().user;
    const doctorId = user?.id;

    if (!doctorId) {
        return {
            todayAppointmentsCount: 0,
            pendingNotesCount: 0,
            prescriptionsSentCount: 0,
        };
    }

    const [appointmentsRes, recordsRes, prescriptionsRes] = await Promise.allSettled([
        listAppointments({ doctorId, size: 100 }),
        listMedicalRecords({ doctorId, size: 50 }),
        listPrescriptionOrdersByDoctor(doctorId, { size: 50 }),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);

    let todayAppointmentsCount = 0;
    if (appointmentsRes.status === 'fulfilled') {
        todayAppointmentsCount = (appointmentsRes.value.content ?? []).filter((item: any) => {
            const date = (item.appointmentDate || item.scheduledAt || '').slice(0, 10);
            return date === todayStr;
        }).length;
    }

    let pendingNotesCount = 0;
    if (recordsRes.status === 'fulfilled') {
        pendingNotesCount = (recordsRes.value.content ?? []).filter(
            (rec: any) => rec.status === 'DRAFT'
        ).length;
    }

    let prescriptionsSentCount = 0;
    if (prescriptionsRes.status === 'fulfilled') {
        prescriptionsSentCount = (prescriptionsRes.value.content ?? []).length;
    }

    return {
        todayAppointmentsCount,
        pendingNotesCount,
        prescriptionsSentCount,
    };
}

/**
 * Prescriptions issued by the signed-in doctor.
 *
 * <p>Read from the prescription orders endpoint. There is no `/doctor/prescriptions`
 * route; see {@link getDoctorStats}.
 */
export async function getPrescriptions(): Promise<Prescription[]> {
    const user = useAuthStore.getState().user;
    const doctorId = user?.id;

    if (!doctorId) return [];

    const res = await listPrescriptionOrdersByDoctor(doctorId, { size: 50 });

    return (res.content ?? []).map((item: any) => ({
        id: item.id,
        drugName: item.drugName,
        dosage: item.dosage,
        frequency: item.instructions || 'Daily',
        status:
            item.status === 'DISPENSED'
                ? 'ACTIVE'
                : item.status === 'REJECTED'
                  ? 'DISCONTINUED'
                  : 'PENDING',
        issuedAt: item.orderedAt || new Date().toISOString(),
    }));
}