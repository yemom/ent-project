package com.clinic.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Real aggregate counts for the dashboards.
 *
 * <p>Every number here is computed by the database. Nothing is estimated,
 * hardcoded, or derived from a seed table.
 */
public record HospitalStatsResponse(
        long totalUsers,
        long activeUsers,
        Map<String, Long> usersByRole,
        long totalPatients,
        long totalDoctors,
        long totalNurses,
        long totalAppointments,
        long appointmentsToday,
        Map<String, Long> appointmentsByStatus,
        long medicalRecords,
        long signedMedicalRecords,
        long labOrders,
        long pendingLabOrders,
        long labResults,
        long prescriptionOrders,
        long pendingPrescriptions,
        long activeAssignments,
        long refundsPendingApproval,
        long openAdmissions,
        long departments,
        long wards,
        long rooms,
        long roomsAvailable,
        long nurseObservations,
        long invoices,
        long invoicesOutstanding,
        java.math.BigDecimal totalBilled,
        java.math.BigDecimal totalCollected,
        List<DailyPoint> appointmentsTrend,
        /** Pharmacy counters: stock value, alerts and movement ledger totals. */
        Map<String, Object> pharmacy,
        /** Laboratory counters: orders, results, validation and critical alerts. */
        Map<String, Object> laboratory
) {
    public record DailyPoint(String date, long total) {
    }
}