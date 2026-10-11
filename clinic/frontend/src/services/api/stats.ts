import { apiClient } from '@/services/api/client';

/** Shape mirrors the backend `HospitalStatsResponse`. All values are real counts. */
export interface HospitalStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<string, number>;
  totalPatients: number;
  totalDoctors: number;
  totalNurses: number;
  totalAppointments: number;
  appointmentsToday: number;
  appointmentsByStatus: Record<string, number>;
  /** Pharmacy counters: stock value, reorder/expiry alerts and ledger totals. */
  pharmacy: {
    medicines: number;
    suppliers: number;
    stockValue: number;
    outOfStock: number;
    lowStock: number;
    expiringSoon: number;
    expired: number;
    batches: number;
    movementsByKind: Record<string, number>;
    /** Cost of goods dispensed this month — distinct from purchases received. */
    costOfGoodsDispensedInPeriod: number;
    valueReceivedInPeriod: number;
  };
  /** Laboratory counters including critical-result volume. */
  laboratory: {
    orders: number;
    pendingOrders: number;
    results: number;
    finalResults: number;
    criticalResults: number;
    laboratories: number;
  };
  medicalRecords: number;
  signedMedicalRecords: number;
  labOrders: number;
  pendingLabOrders: number;
  labResults: number;
  prescriptionOrders: number;
  pendingPrescriptions: number;
  activeAssignments: number;
  refundsPendingApproval: number;
  openAdmissions: number;
  departments: number;
  wards: number;
  rooms: number;
  roomsAvailable: number;
  nurseObservations: number;
  invoices: number;
  invoicesOutstanding: number;
  totalBilled: number;
  totalCollected: number;
  appointmentsTrend: Array<{ date: string; total: number }>;
}

export const STATS_KEY = ['stats', 'hospital'] as const;

export async function fetchHospitalStats(): Promise<HospitalStats> {
  const { data } = await apiClient.get<HospitalStats>('/stats/hospital');
  return data;
}