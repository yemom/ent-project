package com.clinic.ai;

import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Invoice;
import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.LabResultStatus;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ForbiddenException;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.LabOrderRepository;
import com.clinic.repository.LabResultRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.MedicineRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.StockBatchRepository;
import com.clinic.security.CurrentUser;
import com.clinic.security.RolePermissions;
import com.clinic.service.AppointmentService;
import com.clinic.service.MedicalRecordService;
import com.clinic.service.OwnRecordFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns a capability request into computed facts from the real system.
 *
 * <p>This class is the reason the assistant can be trusted with anything. It holds
 * no prompts and talks to no model; it runs the same repositories and services the
 * REST controllers do, under the same {@link CurrentUser} principal, so every
 * number it produces is a number the caller could have obtained from the API
 * directly.
 *
 * <p>Three properties are enforced here rather than left to callers:
 *
 * <ul>
 *   <li><b>Permission.</b> {@link #assertAllowed} refuses before any query runs.
 *       A capability is reachable only by a role that already holds the permission
 *       the underlying REST endpoint requires.</li>
 *   <li><b>Aggregation over disclosure.</b> Most capabilities return counts, not
 *       rows. Returning a list of names would answer a different question than the
 *       one asked, with the patient's identity attached.</li>
 *   <li><b>Bounded input.</b> Date ranges are clamped and page sizes are fixed, so
 *       a request cannot ask the database for an unbounded result set.</li>
 * </ul>
 */
@Service
@Slf4j
public class AiCapabilityService {

    /** Nothing the assistant returns is ever longer than this. */
    private static final int MAX_ROWS = 50;

    /** How far back a caller may reach unless they name a range. */
    private static final int MAX_LOOKBACK_DAYS = 366;

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final MedicineRepository medicineRepository;
    private final StockBatchRepository stockBatchRepository;
    private final LabOrderRepository labOrderRepository;
    private final LabResultRepository labResultRepository;
    private final InvoiceRepository invoiceRepository;
    private final AppointmentService appointmentService;
    private final MedicalRecordService medicalRecordService;
    private final CurrentUser currentUser;
    private final AiProperties aiProperties;
    private final PatientAssignmentRepository patientAssignmentRepository;

    public AiCapabilityService(
            AppointmentRepository appointmentRepository,
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            MedicalRecordRepository medicalRecordRepository,
            MedicineRepository medicineRepository,
            StockBatchRepository stockBatchRepository,
            LabOrderRepository labOrderRepository,
            LabResultRepository labResultRepository,
            InvoiceRepository invoiceRepository,
            AppointmentService appointmentService,
            MedicalRecordService medicalRecordService,
            CurrentUser currentUser,
            AiProperties aiProperties,
            PatientAssignmentRepository patientAssignmentRepository
    ) {
        this.appointmentRepository = appointmentRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.medicineRepository = medicineRepository;
        this.stockBatchRepository = stockBatchRepository;
        this.labOrderRepository = labOrderRepository;
        this.labResultRepository = labResultRepository;
        this.invoiceRepository = invoiceRepository;
        this.appointmentService = appointmentService;
        this.medicalRecordService = medicalRecordService;
        this.currentUser = currentUser;
        this.aiProperties = aiProperties;
        this.patientAssignmentRepository = patientAssignmentRepository;
    }

    /** The capabilities this caller may invoke, for the UI to offer as choices. */
    public List<AiCapability> availableCapabilities() {
        List<AiCapability> available = new ArrayList<>();
        for (AiCapability capability : AiCapability.values()) {
            if (capability.isAvailableTo(currentUser.role())) {
                available.add(capability);
            }
        }
        return available;
    }

    /**
     * Refuses a capability the caller's role may not use.
     *
     * <p>Public and separate from {@link #execute} so the orchestration layer can
     * settle the access-control question before it decides whether the feature is
     * switched on. See {@code AiService.chat} for why that ordering matters.
     *
     * <p>Reads the live principal, never a role from the request body, so a caller
     * cannot claim to be somebody else.
     */
    @Transactional(readOnly = true)
    public void assertCallerAllowed(AiCapability capability) {
        assertAllowed(capability);
    }

    /**
     * Runs a capability for the caller.
     *
     * @throws ForbiddenException if the caller's role does not hold the permission
     */
    @Transactional(readOnly = true)
    public AiCapabilityResult execute(AiCapability capability, Map<String, Object> arguments) {
        assertAllowed(capability);

        Map<String, Object> args = arguments == null ? Map.of() : arguments;
        LocalDate from = parseDate(args.get("from"), LocalDate.now().minusDays(30));
        LocalDate to = parseDate(args.get("to"), LocalDate.now());

        return switch (capability) {
            case APPOINTMENT_METRICS -> appointmentMetrics(from, to);
            case AVAILABLE_SLOTS -> availableSlots(args);
            case PATIENT_REGISTRATIONS -> patientRegistrations(from, to);
            case STAFF_WORKLOAD -> staffWorkload(from, to);
            case PHARMACY_INVENTORY -> pharmacyInventory(args);
            case LABORATORY_WORKLOAD -> laboratoryWorkload();
            case FINANCIAL_SUMMARY -> financialSummary(from, to);
            case CLINICAL_DOCUMENTATION -> clinicalDocumentation(args);
            case PATIENT_OWN_RECORD -> patientOwnRecord(args);
            case PATIENT_OWN_APPOINTMENTS -> patientOwnAppointments();
            case MY_APPOINTMENTS -> myAppointments();
            case OPERATIONAL_FORECAST -> operationalForecast();
        };
    }

    /** Builds a role-scoped daily appointment series and a transparent 7-day baseline. */
    @Transactional(readOnly = true)
    public com.clinic.dto.response.AiHistoricalForecastResponse appointmentForecast(LocalDate requestedFrom,
                                                                                    LocalDate requestedTo) {
        assertAllowed(AiCapability.OPERATIONAL_FORECAST);
        UserRole role = currentUser.role().canonical();
        String scope;
        String label;
        String ownerId = null;
        if (role == UserRole.DOCTOR) {
            scope = "DOCTOR"; label = "Your appointment book"; ownerId = currentUser.userId();
        } else if (role == UserRole.PATIENT) {
            scope = "PATIENT"; label = "Your appointments"; ownerId = currentUser.userId();
        } else if (RolePermissions.hasAny(role, com.clinic.security.Permissions.APPOINTMENT_MANAGE,
                com.clinic.security.Permissions.REPORT_READ)) {
            scope = "HOSPITAL"; label = "Hospital appointments";
        } else {
            LocalDate unavailableTo = requestedTo == null ? LocalDate.now() : requestedTo;
            LocalDate unavailableFrom = requestedFrom == null ? unavailableTo.minusDays(89) : requestedFrom;
            return new com.clinic.dto.response.AiHistoricalForecastResponse("appointments", "Not available",
                    unavailableFrom, unavailableTo, LocalDateTime.now(), "none", 0, false,
                    "Dated appointment history is not available to this role.", List.of(), List.of(),
                    List.of("Role-authorized appointment data"), List.of());
        }
        LocalDate today = LocalDate.now();
        LocalDate to = requestedTo == null ? today : requestedTo;
        LocalDate from = requestedFrom == null ? to.minusDays(89) : requestedFrom;
        if (to.isAfter(today) || from.isAfter(to)) {
            throw new BadRequestException("Choose a valid date range ending today or earlier.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 365) {
            throw new BadRequestException("The appointment history range cannot exceed 366 days.");
        }
        List<Object[]> rows = appointmentRepository.dailyAppointmentSeries(
                from.atStartOfDay(), to.plusDays(1).atStartOfDay(), scope, ownerId);
        Map<LocalDate, Long> values = new LinkedHashMap<>();
        for (Object[] row : rows) {
            LocalDate day = row[0] instanceof java.sql.Date date ? date.toLocalDate()
                    : row[0] instanceof LocalDate date ? date : LocalDate.parse(String.valueOf(row[0]));
            values.put(day, ((Number) row[1]).longValue());
        }
        List<com.clinic.dto.response.AiHistoricalForecastResponse.Point> actual = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            actual.add(new com.clinic.dto.response.AiHistoricalForecastResponse.Point(day, values.getOrDefault(day, 0L)));
        }
        long activeDays = actual.stream().filter(point -> point.value() > 0).count();
        boolean sufficient = actual.size() >= 28 && activeDays >= 7;
        List<com.clinic.dto.response.AiHistoricalForecastResponse.Point> predicted = new ArrayList<>();
        String method = "7-day trailing daily mean; deterministic baseline, not a validated predictive model";
        if (sufficient) {
            double mean = actual.subList(actual.size() - 7, actual.size()).stream()
                    .mapToLong(com.clinic.dto.response.AiHistoricalForecastResponse.Point::value).average().orElse(0);
            long daily = Math.round(mean);
            for (int i = 1; i <= 7; i++) {
                predicted.add(new com.clinic.dto.response.AiHistoricalForecastResponse.Point(to.plusDays(i), daily));
            }
        }
        List<com.clinic.dto.response.AiHistoricalForecastResponse.Insight> insights = new ArrayList<>();
        if (actual.size() >= 28) {
            long recent = actual.subList(actual.size() - 14, actual.size()).stream().mapToLong(
                    com.clinic.dto.response.AiHistoricalForecastResponse.Point::value).sum();
            long prior = actual.subList(actual.size() - 28, actual.size() - 14).stream().mapToLong(
                    com.clinic.dto.response.AiHistoricalForecastResponse.Point::value).sum();
            String comparison = prior == 0 ? (recent == 0
                    ? "No appointments were recorded in either 14-day period."
                    : "Appointments were recorded in the recent period; the comparison period had zero records.")
                    : "The recent 14-day total was " + recent + " compared with " + prior + " in the prior 14 days.";
            insights.add(new com.clinic.dto.response.AiHistoricalForecastResponse.Insight("MEASURED",
                    "Appointment volume comparison", comparison, to.minusDays(27) + " to " + to,
                    "Appointments module; daily persisted appointment counts"));
        }
        String limitation = sufficient
                ? "The estimate repeats the rounded mean of the last seven calendar-day counts for seven days. No uncertainty interval is computed."
                : "At least 28 calendar days and 7 days with appointments are required. No prediction is shown until that threshold is met.";
        return new com.clinic.dto.response.AiHistoricalForecastResponse("daily appointments", label, from, to,
                LocalDateTime.now(), method, actual.size(), sufficient, limitation, actual, predicted,
                List.of("Appointments module", from + " to " + to, scope + " scope"), insights);
    }

    /**
     * Refuses before doing any work.
     *
     * <p>Reads the live principal, never a role from the request body, so a caller
     * cannot claim to be somebody else.
     */
    private void assertAllowed(AiCapability capability) {
        UserRole role = currentUser.role();
        if (!capability.isAvailableTo(role)) {
            log.warn("Denied AI capability {} for userId={} role={}",
                    capability.id(), currentUser.userId(), role);
            throw new ForbiddenException(
                    "You do not have access to this information through the assistant");
        }
    }

    // ------------------------------------------------------------------
    // Capabilities
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public AiCapabilityResult operationalForecastFor(UserRole requestedRole) {
        assertAllowed(AiCapability.OPERATIONAL_FORECAST);
        UserRole currentRole = currentUser.role().canonical();
        UserRole effectiveRole = currentRole;
        if (requestedRole != null) {
            if (currentRole == UserRole.SUPER_ADMIN || currentRole == UserRole.ADMIN) {
                effectiveRole = requestedRole.canonical();
            } else {
                throw new ForbiddenException("Only administrators can query forecasts for other roles.");
            }
        }
        return operationalForecast(effectiveRole);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> allRoleForecasts() {
        assertAllowed(AiCapability.OPERATIONAL_FORECAST);
        UserRole currentRole = currentUser.role().canonical();
        if (currentRole != UserRole.SUPER_ADMIN && currentRole != UserRole.ADMIN) {
            throw new ForbiddenException("Only administrators can view cross-role operational forecasts.");
        }
        Map<String, Object> all = new LinkedHashMap<>();
        all.put("hospital", operationalForecast(UserRole.SUPER_ADMIN).facts());
        all.put("doctor", operationalForecast(UserRole.DOCTOR).facts());
        all.put("nurse", operationalForecast(UserRole.NURSE).facts());
        all.put("laboratory", operationalForecast(UserRole.LAB_TECHNICIAN).facts());
        all.put("pharmacist", operationalForecast(UserRole.PHARMACIST).facts());
        all.put("cashier", operationalForecast(UserRole.CASHIER).facts());
        all.put("reception", operationalForecast(UserRole.RECEPTIONIST).facts());
        return all;
    }

    private AiCapabilityResult operationalForecast() {
        return operationalForecast(currentUser.role().canonical());
    }

    private AiCapabilityResult operationalForecast(UserRole role) {
        LocalDate today = LocalDate.now();
        LocalDate currentStart = today.minusDays(30);
        LocalDate previousStart = currentStart.minusDays(30);
        LocalDateTime currentFrom = currentStart.atStartOfDay();
        LocalDateTime currentTo = today.plusDays(1).atStartOfDay();
        LocalDateTime previousFrom = previousStart.atStartOfDay();

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("forecastHorizon", "next 30 days");
        facts.put("limitations", "Projection is directional, not a clinical or financial guarantee.");

        if (role == UserRole.RECEPTIONIST) {
            long registrations = patientRepository.countCreatedBetween(currentFrom, currentTo);
            long appts = appointmentRepository.countByAppointmentDateBetween(currentFrom, currentTo);
            facts.put("metric", "patient registration and bookings");
            facts.put("patientRegistrations30Days", registrations);
            facts.put("bookedAppointments30Days", appts);
            facts.put("forecastAvailable", true);
            facts.put("suggestions", List.of("Monitor peak arrival times and check doctor schedule availability.",
                    "Ask the assistant to list available appointment slots."));
            return AiCapabilityResult.of(facts, List.of("Front desk module", currentStart + " to " + today), false);
        }

        if (role == UserRole.NURSE) {
            long assigned = currentUser.role().canonical() == UserRole.NURSE
                    ? patientAssignmentRepository.countByNurseIdAndReleasedAtIsNull(currentUser.userId())
                    : patientAssignmentRepository.countByReleasedAtIsNull();
            facts.put("metric", "assigned patients");
            facts.put("currentValue", assigned);
            facts.put("forecastAvailable", false);
            facts.put("reason", "No dated assignment history is available for a reliable trend.");
            facts.put("suggestions", assigned == 0
                    ? List.of("Review the patient assignment queue for new work.")
                    : List.of("Review assigned patients with pending vitals or follow-up tasks.",
                    "Ask the assistant to summarise your assigned patient workload."));
            return AiCapabilityResult.of(facts, List.of("Patient assignment module", "current active assignments"), false);
        }

        if (role == UserRole.LAB_TECHNICIAN || role == UserRole.LABORATORY) {
            Map<String, Long> statuses = new LinkedHashMap<>();
            for (Object[] row : labOrderRepository.countGroupedByStatus()) {
                statuses.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
            }
            facts.put("metric", "laboratory queue");
            facts.put("currentValue", statuses);
            facts.put("forecastAvailable", false);
            facts.put("reason", "The current queue is available, but dated queue history is not stored for a defensible projection.");
            facts.put("suggestions", List.of("Review pending orders first to reduce queue age.",
                    "Ask the assistant for a laboratory workload breakdown by status."));
            return AiCapabilityResult.of(facts, List.of("Laboratory module", "current order status counts"), false);
        }

        if (role == UserRole.PHARMACIST) {
            long expiring = stockBatchRepository
                    .countByExpiryDateLessThanEqualAndQuantityGreaterThanAndDeletedFalse(
                            today.plusDays(30), BigDecimal.ZERO);
            facts.put("metric", "stock batches nearing expiry");
            facts.put("currentValue", expiring);
            facts.put("forecastAvailable", false);
            facts.put("reason", "Inventory movement history is not enough to predict demand from this snapshot alone.");
            facts.put("suggestions", expiring > 0
                    ? List.of("Review batches expiring within 30 days and plan stock rotation.",
                    "Ask the assistant to list low-stock and expiring medicines.")
                    : List.of("Review low-stock levels and continue routine stock checks."));
            return AiCapabilityResult.of(facts, List.of("Pharmacy inventory module", "next 30 days"), false);
        }

        if (role == UserRole.CASHIER) {
            Map<String, Object> financial = financialSummary(currentStart, today).facts();
            facts.put("metric", "financial activity");
            facts.put("currentValue", financial);
            facts.put("forecastAvailable", false);
            facts.put("reason", "A directional financial projection requires a longer approved historical series.");
            facts.put("suggestions", List.of("Review outstanding balances and invoice statuses.",
                    "Ask the assistant for a financial summary for a selected date range."));
            return AiCapabilityResult.of(facts, List.of("Billing module", currentStart + " to " + today), false);
        }

        long current;
        long previous;
        String scope;
        if (role == UserRole.DOCTOR) {
            if (currentUser.role().canonical() == UserRole.DOCTOR) {
                current = appointmentRepository.countByDoctorIdAndAppointmentDateBetween(
                        currentUser.userId(), currentFrom, currentTo);
                previous = appointmentRepository.countByDoctorIdAndAppointmentDateBetween(
                        currentUser.userId(), previousFrom, currentFrom);
                scope = "caller doctor's appointments";
            } else {
                current = appointmentRepository.countByAppointmentDateBetween(currentFrom, currentTo);
                previous = appointmentRepository.countByAppointmentDateBetween(previousFrom, currentFrom);
                scope = "clinical appointments";
            }
        } else if (role == UserRole.PATIENT) {
            current = appointmentRepository.findByPatientIdAndAppointmentDateBetween(
                    currentUser.userId(), currentFrom, currentTo, PageRequest.of(0, 1)).getTotalElements();
            previous = appointmentRepository.findByPatientIdAndAppointmentDateBetween(
                    currentUser.userId(), previousFrom, currentFrom, PageRequest.of(0, 1)).getTotalElements();
            scope = "caller's appointments";
        } else {
            current = appointmentRepository.countByAppointmentDateBetween(currentFrom, currentTo);
            previous = appointmentRepository.countByAppointmentDateBetween(previousFrom, currentFrom);
            scope = "hospital appointments";
        }

        facts.put("metric", scope);
        facts.put("current30DayCount", current);
        facts.put("previous30DayCount", previous);
        facts.put("forecastAvailable", previous > 0);
        if (previous > 0) {
            double change = (double) (current - previous) / previous;
            facts.put("changeFraction", Math.round(change * 1000.0) / 1000.0);
            facts.put("projectedNext30DayCount", Math.max(0, Math.round(current * (1.0 + change))));
            facts.put("suggestions", current > previous
                    ? List.of("Review capacity for the next 30 days because activity is above the previous period.",
                    "Ask the assistant to break down appointment outcomes.")
                    : List.of("Review appointment availability and follow-up capacity for the next 30 days.",
                    "Ask the assistant to find available appointment slots."));
        } else {
            facts.put("reason", "Fewer than two non-empty comparison periods are available.");
            facts.put("suggestions", List.of("Collect more dated activity before relying on a projection.",
                    "Review the appointment book and upcoming availability."));
        }
        return AiCapabilityResult.of(facts,
                List.of("Appointments module", previousStart + " to " + today), false);
    }

    private AiCapabilityResult appointmentMetrics(LocalDate from, LocalDate to) {
        DateRange range = clamp(from, to);
        LocalDate fromDate = range.from();
        LocalDate toDate = range.to();

        long total = appointmentRepository.countByAppointmentDateBetween(
                fromDate.atStartOfDay(), toDate.plusDays(1).atStartOfDay());

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (AppointmentStatus status : AppointmentStatus.values()) {
            byStatus.put(status.name(), 0L);
        }
        for (Object[] row : appointmentRepository.countGroupedByStatus()) {
            byStatus.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("rangeStart", fromDate.toString());
        facts.put("rangeEnd", toDate.toString());
        facts.put("appointmentsInRange", total);
        facts.put("byStatus", byStatus);

        // Per-day trend, so "is this week unusually busy" is answerable from data
        // rather than guessed from a single total.
        List<Map<String, Object>> trend = new ArrayList<>();
        for (Object[] row : appointmentRepository.dailyVolumeSince(fromDate.atStartOfDay())) {
            trend.add(Map.of("day", String.valueOf(row[0]), "appointments", ((Number) row[1]).longValue()));
            if (trend.size() >= MAX_ROWS) {
                break;
            }
        }
        facts.put("dailyVolume", trend);

        return AiCapabilityResult.of(facts,
                List.of("Appointments module", fromDate + " to " + toDate), false);
    }

    private AiCapabilityResult availableSlots(Map<String, Object> args) {
        String doctorId = asString(args.get("doctorId"));
        if (doctorId == null || doctorId.isBlank()) {
            // 400, not 403. The caller *is* allowed to ask this question — the server
            // already cleared them at the capability gate — they simply did not say
            // which doctor. A 403 told them "you do not have permission", which is
            // both false and unactionable: no amount of retrying helps, and it hides
            // the one thing that would.
            //
            // Answering for every doctor would be the real enumeration risk, and that
            // is deliberately not done: the question cannot be answered honestly
            // without knowing who is being asked about.
            throw new BadRequestException(
                    "Specify a doctor to search for available slots — for example "
                            + "\"Which slots are free for Dr Mensah?\".");
        }

        LocalDate from = parseDate(args.get("from"), LocalDate.now());
        LocalDate to = parseDate(args.get("to"), from.plusDays(7));
        DateRange range = clamp(from, to);
        LocalDate fromDate = range.from();
        LocalDate toDate = range.to();

        // Goes through the service, so doctor- and patient-scoped callers inherit
        // the same ownership rules the REST endpoint enforces.
        var page = appointmentService.search(
                new AppointmentSearchRequest(null, doctorId, null,
                        fromDate.atStartOfDay(), toDate.plusDays(1).atStartOfDay(), null),
                PageRequest.of(0, MAX_ROWS));

        List<Map<String, Object>> booked = new ArrayList<>();
        for (var appointment : page.getContent()) {
            booked.add(Map.of(
                    "id", appointment.id(),
                    "startsAt", String.valueOf(appointment.appointmentDate()),
                    "durationMinutes", appointment.duration() == null ? 0 : appointment.duration(),
                    "status", String.valueOf(appointment.status()),
                    "reason", appointment.reasonForVisit() == null ? "" : appointment.reasonForVisit()));
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("doctorId", doctorId);
        facts.put("doctorName", page.getContent().stream()
                .filter(a -> a.doctor() != null)
                .map(a -> a.doctor().fullName())
                .findFirst()
                .orElse("Doctor"));
        facts.put("windowStart", fromDate.toString());
        facts.put("windowEnd", toDate.toString());
        facts.put("bookedCount", booked.size());
        facts.put("booked", booked);
        if (!booked.isEmpty()) {
            facts.put("busiestDay", busiestDay(booked));
        }

        return AiCapabilityResult.of(facts,
                List.of("Appointments module", "Scheduling window " + fromDate + " to " + toDate), false);
    }

    private AiCapabilityResult patientRegistrations(LocalDate from, LocalDate to) {
        DateRange range = clamp(from, to);
        LocalDate fromDate = range.from();
        LocalDate toDate = range.to();

        long registered = patientRepository.countCreatedBetween(
                fromDate.atStartOfDay(), toDate.plusDays(1).atStartOfDay());
        long previous = patientRepository.countCreatedBetween(
                fromDate.minusDays(daysBetween(fromDate, toDate)).atStartOfDay(), fromDate.atStartOfDay());

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("rangeStart", fromDate.toString());
        facts.put("rangeEnd", toDate.toString());
        facts.put("newPatients", registered);
        facts.put("previousPeriodNewPatients", previous);
        facts.put("change", registered - previous);
        facts.put("totalRegisteredPatients", patientRepository.count());

        return AiCapabilityResult.of(facts,
                List.of("Patient directory", fromDate + " to " + toDate), false);
    }

    private AiCapabilityResult staffWorkload(LocalDate from, LocalDate to) {
        DateRange range = clamp(from, to);
        LocalDate fromDate = range.from();
        LocalDate toDate = range.to();

        var doctors = doctorRepository.findAll(PageRequest.of(0, MAX_ROWS)).getContent();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (var doctor : doctors) {
            long load = appointmentRepository.countByDoctorIdAndAppointmentDateBetween(
                    doctor.getId(), fromDate.atStartOfDay(), toDate.plusDays(1).atStartOfDay());
            rows.add(Map.of(
                    "doctorId", doctor.getId(),
                    "doctorName", doctor.getFullName(),
                    "specialization", doctor.getSpecialization() == null ? "" : doctor.getSpecialization(),
                    "appointments", load));
        }
        rows.sort((a, b) -> Long.compare(
                ((Number) b.get("appointments")).longValue(),
                ((Number) a.get("appointments")).longValue()));

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("rangeStart", fromDate.toString());
        facts.put("rangeEnd", toDate.toString());
        facts.put("doctorCount", doctors.size());
        facts.put("workload", rows);

        return AiCapabilityResult.of(facts,
                List.of("Doctors module", "Appointments module", fromDate + " to " + toDate), false);
    }

    private AiCapabilityResult pharmacyInventory(Map<String, Object> args) {
        LocalDate today = LocalDate.now();
        int expiringWithinDays = intArg(args.get("expiringWithinDays"), 90, 7, 365);

        List<Map<String, Object>> lowStock = new ArrayList<>();
        for (var medicine : medicineRepository.findLowStock(today)) {
            lowStock.add(Map.of(
                    "code", medicine.getCode(),
                    "name", medicine.getName(),
                    "reorderLevel", medicine.getReorderLevel() == null ? 0 : medicine.getReorderLevel()));
            if (lowStock.size() >= MAX_ROWS) {
                break;
            }
        }

        List<Map<String, Object>> outOfStock = new ArrayList<>();
        for (var medicine : medicineRepository.findOutOfStock(today)) {
            outOfStock.add(Map.of("code", medicine.getCode(), "name", medicine.getName()));
            if (outOfStock.size() >= MAX_ROWS) {
                break;
            }
        }

        List<Map<String, Object>> expiring = new ArrayList<>();
        for (var batch : stockBatchRepository.findExpiring(today.plusDays(expiringWithinDays))) {
            expiring.add(Map.of(
                    "batchNumber", batch.getBatchNumber() == null ? "" : batch.getBatchNumber(),
                    "quantity", batch.getQuantity() == null ? BigDecimal.ZERO : batch.getQuantity(),
                    "expiresOn", String.valueOf(batch.getExpiryDate())));
            if (expiring.size() >= MAX_ROWS) {
                break;
            }
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("asOf", today.toString());
        facts.put("activeMedicines", medicineRepository.countByActiveTrue());
        facts.put("lowStockCount", lowStock.size());
        facts.put("lowStock", lowStock);
        facts.put("outOfStockCount", outOfStock.size());
        facts.put("outOfStock", outOfStock);
        facts.put("batchesExpiringWithinDays", expiringWithinDays);
        facts.put("expiringBatches", expiring);
        facts.put("totalStockValue", medicineRepository.totalStockValue(today));

        return AiCapabilityResult.of(facts,
                List.of("Pharmacy inventory", "Computed as of " + today), false);
    }

    private AiCapabilityResult laboratoryWorkload() {
        Map<String, Long> orders = new LinkedHashMap<>();
        for (LabOrderStatus status : LabOrderStatus.values()) {
            orders.put(status.getValue(), labOrderRepository.countByStatus(status));
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("ordersByStatus", orders);
        facts.put("resultsByStatus", Map.of(
                LabResultStatus.DRAFT.name(), labResultRepository.countByStatus(LabResultStatus.DRAFT),
                LabResultStatus.FINAL.name(), labResultRepository.countByStatus(LabResultStatus.FINAL)));
        facts.put("awaitingValidation", labResultRepository.countByStatus(LabResultStatus.DRAFT));
        facts.put("criticalResultsFlagged", labResultRepository.countByCriticalTrue());

        return AiCapabilityResult.of(facts, List.of("Laboratory module"), false);
    }

    private AiCapabilityResult financialSummary(LocalDate from, LocalDate to) {
        DateRange range = clamp(from, to);
        LocalDate fromDate = range.from();
        LocalDate toDate = range.to();
        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end = toDate.plusDays(1).atStartOfDay();

        Map<String, Long> invoices = new LinkedHashMap<>();
        for (Invoice.Status status : Invoice.Status.values()) {
            invoices.put(status.name(), 0L);
        }
        for (Object[] row : invoiceRepository.countGroupedByStatus()) {
            invoices.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("rangeStart", fromDate.toString());
        facts.put("rangeEnd", toDate.toString());
        facts.put("invoicesByStatus", invoices);
        facts.put("collectedInRange", invoiceRepository.collectedBetween(start, end));
        facts.put("totalBilledAllTime", invoiceRepository.totalBilled());
        facts.put("totalCollectedAllTime", invoiceRepository.totalCollected());
        facts.put("outstandingBalance", invoiceRepository.totalOutstanding());

        return AiCapabilityResult.of(facts,
                List.of("Billing module", fromDate + " to " + toDate), false);
    }

    /**
     * Draft documentation from records the clinician is already assigned.
     *
     * <p>Gated twice: {@code AI_ALLOW_IDENTIFIABLE_DATA} must be on, and the
     * caller must hold {@code diagnosis:write}. Even then the result is labelled a
     * draft — see {@code AiService}'s system prompt and response labelling.
     */
    private AiCapabilityResult clinicalDocumentation(Map<String, Object> args) {
        requireIdentifiableDataAllowed();

        String patientId = asString(args.get("patientId"));
        if (patientId == null || patientId.isBlank()) {
            // 400 for the same reason as `availableSlots`: this is a missing input,
            // not a permission decision. The caller cleared the capability gate
            // already, and "you do not have permission" would send them looking for
            // a rights problem they do not have.
            throw new BadRequestException(
                    "Specify the patient whose documentation to draft — open the patient "
                            + "first, or enter their patient ID.");
        }

        var page = medicalRecordService.search(
                new MedicalRecordSearchRequest(patientId, null, null, null, null, null, null),
                PageRequest.of(0, 10));

        if (page.isEmpty()) {
            return AiCapabilityResult.emptyResult("Medical records for the specified patient");
        }

        List<Map<String, Object>> records = new ArrayList<>();
        for (var record : page.getContent()) {
            records.add(Map.of(
                    "recordDate", String.valueOf(record.recordDate()),
                    "type", record.medicalRecordType() == null ? "" : record.medicalRecordType(),
                    "diagnosis", orEmpty(record.diagnosis()),
                    "treatment", orEmpty(record.treatment()),
                    "prescription", orEmpty(record.prescription()),
                    "testResults", orEmpty(record.testResults()),
                    "followUpRequired", record.followUpRequired() != null && record.followUpRequired(),
                    "confidential", record.confidential() != null && record.confidential()));
            if (records.size() >= 10) {
                break;
            }
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("patientId", patientId);
        facts.put("recordCount", page.getTotalElements());
        facts.put("records", records);

        return AiCapabilityResult.of(facts,
                List.of("Medical records module", "Patient " + patientId), true);
    }

    /**
     * The caller's own record.
     *
     * <p>The patient is the principal. There is no parameter to point this at
     * another account, which is the same guarantee the {@code /medical-records/me}
     * endpoint makes.
     */
    private AiCapabilityResult patientOwnRecord(Map<String, Object> args) {
        String callerId = currentUser.userId();
        int limit = intArg(args.get("limit"), 10, 1, 25);

        var page = medicalRecordService.getOwnRecords(
                OwnRecordFilter.of(), org.springframework.data.domain.PageRequest.of(0, limit));

        List<Map<String, Object>> records = new ArrayList<>();
        for (var record : page.getContent()) {
            records.add(Map.of(
                    "recordDate", String.valueOf(record.recordDate()),
                    "diagnosis", orEmpty(record.diagnosis()),
                    "treatment", orEmpty(record.treatment()),
                    "prescription", orEmpty(record.prescription()),
                    "testResults", orEmpty(record.testResults()),
                    "followUpRequired", record.followUpRequired() != null && record.followUpRequired(),
                    "final", record.signed()));
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("recordCount", page.getTotalElements());
        facts.put("records", records);

        return AiCapabilityResult.of(facts,
                List.of("Your own medical records"), true);
    }

    private AiCapabilityResult patientOwnAppointments() {
        String callerId = currentUser.userId();
        var page = appointmentService.search(
                new AppointmentSearchRequest(callerId, null, null, null, null, null),
                PageRequest.of(0, MAX_ROWS));

        List<Map<String, Object>> appointments = new ArrayList<>();
        for (var appointment : page.getContent()) {
            appointments.add(Map.of(
                    "startsAt", String.valueOf(appointment.appointmentDate()),
                    "status", String.valueOf(appointment.status()),
                    "doctorName", appointment.doctor() == null ? "" : appointment.doctor().fullName(),
                    "reason", appointment.reasonForVisit() == null ? "" : appointment.reasonForVisit()));
            if (appointments.size() >= MAX_ROWS) {
                break;
            }
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("appointmentCount", page.getTotalElements());
        facts.put("appointments", appointments);

        return AiCapabilityResult.of(facts, List.of("Your own appointments"), false);
    }

    /**
     * The caller's own appointment book.
     *
     * <p>Passes no filters on purpose: {@code AppointmentService.scopeToCaller}
     * narrows this to a doctor's own panel or to the patient's own appointments, so
     * the assistant cannot show a clinician a colleague's diary, and cannot be
     * widened later by adding a filter here.
     */
    private AiCapabilityResult myAppointments() {
        var page = appointmentService.search(
                new AppointmentSearchRequest(null, null, null, null, null, null),
                PageRequest.of(0, MAX_ROWS));

        List<Map<String, Object>> appointments = new ArrayList<>();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (var appointment : page.getContent()) {
            String status = String.valueOf(appointment.status());
            byStatus.merge(status, 1L, Long::sum);
            appointments.add(Map.of(
                    "startsAt", String.valueOf(appointment.appointmentDate()),
                    "status", status,
                    "doctorName", appointment.doctor() == null ? "" : appointment.doctor().fullName(),
                    "reason", appointment.reasonForVisit() == null ? "" : appointment.reasonForVisit()));
            if (appointments.size() >= MAX_ROWS) {
                break;
            }
        }

        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("appointmentCount", page.getTotalElements());
        facts.put("byStatus", byStatus);
        facts.put("appointments", appointments);
        facts.put("needsConfirmation", byStatus.getOrDefault("SCHEDULED", 0L));

        return AiCapabilityResult.of(facts, List.of("Your own appointment book"), false);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Blocks the capabilities that would put clinical free text into a prompt.
     *
     * <p>A deployment that has not explicitly approved sending identifiable data to
     * a third party cannot use them at all. Failing closed here means the default
     * configuration transmits no patient information anywhere.
     */
    private void requireIdentifiableDataAllowed() {
        if (!aiProperties.isAllowIdentifiableData()) {
            throw new ForbiddenException(
                    "This deployment has not enabled AI processing of identifiable clinical data. "
                            + "The assistant can still answer operational questions.");
        }
    }

    /** Clamps a range into the past and into a sane maximum length. */
    private DateRange clamp(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate safeTo = to == null ? today : to.isAfter(today) ? today : to;
        LocalDate earliest = today.minusDays(MAX_LOOKBACK_DAYS);
        LocalDate safeFrom = from == null ? earliest
                : from.isBefore(earliest) ? earliest
                : from;
        if (safeFrom.isAfter(safeTo)) {
            safeFrom = safeTo;
        }
        return new DateRange(safeFrom, safeTo);
    }

    private long daysBetween(LocalDate from, LocalDate to) {
        return Math.max(1L, java.time.temporal.ChronoUnit.DAYS.between(from, to));
    }

    /**
     * A validated date window.
     *
     * <p>Exists because the clamp has to hand back two related values; returning a
     * record makes the pair impossible to pass around reversed.
     */
    private record DateRange(LocalDate from, LocalDate to) {
    }

    private String busiestDay(List<Map<String, Object>> booked) {
        Map<String, Long> perDay = new LinkedHashMap<>();
        for (Map<String, Object> entry : booked) {
            String day = String.valueOf(entry.get("startsAt"));
            perDay.merge(day.substring(0, Math.min(10, day.length())), 1L, Long::sum);
        }
        return perDay.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("");
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private LocalDate parseDate(Object raw, LocalDate fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return LocalDate.parse(String.valueOf(raw));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private int intArg(Object raw, int fallback, int min, int max) {
        if (raw == null) {
            return fallback;
        }
        try {
            int value = Integer.parseInt(String.valueOf(raw));
            return Math.max(min, Math.min(max, value));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String asString(Object raw) {
        return raw == null ? null : String.valueOf(raw);
    }
}
