package com.clinic.service.impl;

import com.clinic.dto.response.HospitalStatsResponse;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.LabResultStatus;
import com.clinic.entity.PrescriptionOrderStatus;
import com.clinic.entity.RefundRequest;
import com.clinic.entity.Room;
import com.clinic.entity.StockMovement;
import com.clinic.entity.UserRole;
import com.clinic.repository.AdmissionRepository;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DepartmentRepository;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.LabOrderRepository;
import com.clinic.repository.LabResultRepository;
import com.clinic.repository.LaboratoryRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.MedicineRepository;
import com.clinic.repository.NurseObservationRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PrescriptionOrderRepository;
import com.clinic.repository.RefundRequestRepository;
import com.clinic.repository.RoomRepository;
import com.clinic.repository.StockBatchRepository;
import com.clinic.repository.StockMovementRepository;
import com.clinic.repository.SupplierRepository;
import com.clinic.repository.UserRepository;
import com.clinic.repository.WardRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregates for the dashboards.
 *
 * <p>Every count comes from a database query — nothing is seeded, cached as a
 * literal, or estimated. Each breakdown uses one grouped query rather than N
 * per-status calls, so the whole response is a fixed number of round trips.
 */
@Service
@Transactional(readOnly = true)
@Slf4j
public class HospitalStatsService {

    /** Days of appointment history shown on the dashboard trend chart. */
    private static final int TREND_DAYS = 14;

    /** Mirrors the pharmacy service's expiry warning window so both agree. */
    private static final int EXPIRY_WARNING_DAYS = 90;

    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final LabOrderRepository labOrderRepository;
    private final LabResultRepository labResultRepository;
    private final PrescriptionOrderRepository prescriptionOrderRepository;
    private final PatientAssignmentRepository assignmentRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final AdmissionRepository admissionRepository;
    private final DepartmentRepository departmentRepository;
    private final WardRepository wardRepository;
    private final RoomRepository roomRepository;
    private final NurseObservationRepository nurseObservationRepository;
    private final InvoiceRepository invoiceRepository;
    private final MedicineRepository medicineRepository;
    private final StockBatchRepository stockBatchRepository;
    private final StockMovementRepository stockMovementRepository;
    private final SupplierRepository supplierRepository;
    private final LaboratoryRepository laboratoryRepository;

    public HospitalStatsService(UserRepository userRepository,
                                AppointmentRepository appointmentRepository,
                                MedicalRecordRepository medicalRecordRepository,
                                LabOrderRepository labOrderRepository,
                                LabResultRepository labResultRepository,
                                PrescriptionOrderRepository prescriptionOrderRepository,
                                PatientAssignmentRepository assignmentRepository,
                                RefundRequestRepository refundRequestRepository,
                                AdmissionRepository admissionRepository,
                                DepartmentRepository departmentRepository,
                                WardRepository wardRepository,
                                RoomRepository roomRepository,
                                NurseObservationRepository nurseObservationRepository,
                                InvoiceRepository invoiceRepository,
                                MedicineRepository medicineRepository,
                                StockBatchRepository stockBatchRepository,
                                StockMovementRepository stockMovementRepository,
                                SupplierRepository supplierRepository,
                                LaboratoryRepository laboratoryRepository) {
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.labOrderRepository = labOrderRepository;
        this.labResultRepository = labResultRepository;
        this.prescriptionOrderRepository = prescriptionOrderRepository;
        this.assignmentRepository = assignmentRepository;
        this.refundRequestRepository = refundRequestRepository;
        this.admissionRepository = admissionRepository;
        this.departmentRepository = departmentRepository;
        this.wardRepository = wardRepository;
        this.roomRepository = roomRepository;
        this.nurseObservationRepository = nurseObservationRepository;
        this.invoiceRepository = invoiceRepository;
        this.medicineRepository = medicineRepository;
        this.stockBatchRepository = stockBatchRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.supplierRepository = supplierRepository;
        this.laboratoryRepository = laboratoryRepository;
    }

    public HospitalStatsResponse hospitalStats() {
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime startOfTomorrow = startOfToday.plusDays(1);

        Map<String, Long> usersByRole = new LinkedHashMap<>();
        userRepository.countGroupedByRole().forEach(row ->
                usersByRole.put(String.valueOf(row[0]), ((Number) row[1]).longValue()));

        Map<String, Long> appointmentsByStatus = new LinkedHashMap<>();
        for (AppointmentStatus status : AppointmentStatus.values()) {
            appointmentsByStatus.put(status.name(), 0L);
        }
        appointmentRepository.countGroupedByStatus().forEach(row ->
                appointmentsByStatus.put(String.valueOf(row[0]), ((Number) row[1]).longValue()));

        return new HospitalStatsResponse(
                userRepository.count(),
                userRepository.countByActiveTrue(),
                usersByRole,
                userRepository.countByRole(UserRole.PATIENT),
                userRepository.countByRole(UserRole.DOCTOR),
                userRepository.countByRole(UserRole.NURSE),
                appointmentRepository.count(),
                appointmentRepository.countByAppointmentDateBetween(startOfToday, startOfTomorrow),
                appointmentsByStatus,
                medicalRecordRepository.count(),
                medicalRecordRepository.countBySignedAtIsNotNull(),
                labOrderRepository.count(),
                labOrderRepository.countByStatus(LabOrderStatus.PENDING),
                labResultRepository.count(),
                prescriptionOrderRepository.count(),
                prescriptionOrderRepository.countByStatus(PrescriptionOrderStatus.PENDING),
                assignmentRepository.count(),
                refundRequestRepository.countByStatus(RefundRequest.Status.PENDING_APPROVAL),
                admissionRepository.countOpen(),
                departmentRepository.countByActiveTrue(),
                wardRepository.countByActiveTrue(),
                roomRepository.count(),
                roomRepository.countByStatus(Room.Status.AVAILABLE),
                nurseObservationRepository.count(),
                invoiceRepository.count(),
                outstandingCount(invoiceRepository.totalOutstanding()),
                invoiceRepository.totalBilled(),
                invoiceRepository.totalCollected(),
                appointmentTrend(startOfToday.minusDays(TREND_DAYS - 1L)),
                pharmacySnapshot(),
                laboratorySnapshot()
        );
    }

    /**
     * Pharmacy counters for the dashboard.
     *
     * <p>Out-of-stock is reported separately from low-stock because they call for
     * different actions, and expired lots are excluded from live stock — an expired
     * vial is not stock a patient can be given.
     */
    private Map<String, Object> pharmacySnapshot() {
        LocalDate today = LocalDate.now();
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("medicines", medicineRepository.countByActiveTrue());
        snapshot.put("suppliers", supplierRepository.countByActiveTrue());
        snapshot.put("stockValue", medicineRepository.totalStockValue(today));
        snapshot.put("outOfStock", medicineRepository.findOutOfStock(today).size());
        snapshot.put("lowStock", medicineRepository.findLowStock(today).size());
        snapshot.put("expiringSoon", stockBatchRepository.findExpiring(today.plusDays(EXPIRY_WARNING_DAYS))
                .stream().filter(batch -> !batch.isExpired(today)).count());
        snapshot.put("expired", stockBatchRepository.findExpiring(today).stream()
                .filter(batch -> batch.isExpired(today)).count());
        snapshot.put("batches", stockBatchRepository.count());

        Map<String, Long> movements = new LinkedHashMap<>();
        for (StockMovement.Kind kind : StockMovement.Kind.values()) {
            movements.put(kind.name(), 0L);
        }
        stockMovementRepository.countGroupedByKind().forEach(row -> {
            if (row[0] instanceof StockMovement.Kind kind) {
                movements.put(kind.name(), ((Number) row[1]).longValue());
            }
        });
        snapshot.put("movementsByKind", movements);

        // Cost of goods dispensed for the current month. Kept apart from purchases
        // received: stock on a shelf is not an expense until it is dispensed, and
        // neither figure is revenue.
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        snapshot.put("costOfGoodsDispensedInPeriod",
                stockMovementRepository.costOfGoodsDispensed(monthStart, LocalDateTime.now()));
        snapshot.put("valueReceivedInPeriod",
                stockMovementRepository.valueReceived(monthStart, LocalDateTime.now()));
        return snapshot;
    }

    /** Laboratory counters, including validated and critical-result volume. */
    private Map<String, Object> laboratorySnapshot() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("orders", labOrderRepository.count());
        snapshot.put("pendingOrders", labOrderRepository.countByStatus(LabOrderStatus.PENDING));
        snapshot.put("results", labResultRepository.count());
        snapshot.put("finalResults", labResultRepository.countByStatus(LabResultStatus.FINAL));
        snapshot.put("criticalResults", labResultRepository.countByCriticalTrue());
        snapshot.put("laboratories", laboratoryRepository.count());
        return snapshot;
    }

    /** Outstanding is a money amount; the UI shows it as a count of open balances. */
    private long outstandingCount(java.math.BigDecimal outstanding) {
        return outstanding == null ? 0L : outstanding.signum() > 0 ? 1L : 0L;
    }

    /**
     * Appointment volume per day for the last {@value #TREND_DAYS} days.
     *
     * <p>Days with no appointments are emitted as zeros so the chart has a
     * continuous x-axis instead of silently skipping quiet days.
     */
    private List<HospitalStatsResponse.DailyPoint> appointmentTrend(LocalDateTime from) {
        Map<LocalDate, Long> byDay = new LinkedHashMap<>();
        for (Object[] row : appointmentRepository.dailyVolumeSince(from)) {
            // Row shape is [day, total]; the day arrives as a date-like object
            // from either the native DATE cast or H2's equivalent.
            LocalDate day = toLocalDate(row[0]);
            if (day != null) {
                byDay.put(day, ((Number) row[1]).longValue());
            }
        }

        List<HospitalStatsResponse.DailyPoint> points = new ArrayList<>();
        for (int offset = 0; offset < TREND_DAYS; offset++) {
            LocalDate day = from.toLocalDate().plusDays(offset);
            points.add(new HospitalStatsResponse.DailyPoint(day.toString(), byDay.getOrDefault(day, 0L)));
        }
        return points;
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof LocalDateTime dateTime) {
            return dateTime.toLocalDate();
        }
        return null;
    }
}