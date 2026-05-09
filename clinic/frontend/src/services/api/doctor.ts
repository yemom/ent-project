import { apiClient } from '@/services/api/client';
import type { Appointment, Prescription, DoctorStats } from '@/types/api';

// Fetch today's appointments for the logged-in doctor
export async function getTodayAppointments() {
    const { data } = await apiClient.get<Appointment[]>('/doctor/appointments/today');
    return data;
}

// Fetch dashboard stats
export async function getDoctorStats() {
    const { data } = await apiClient.get<DoctorStats>('/doctor/stats');
    return data;
}

// Fetch prescriptions
export async function getPrescriptions() {
    const { data } = await apiClient.get<Prescription[]>('/doctor/prescriptions');
    return data;
}