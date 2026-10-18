package com.clinic.service.impl;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentStatusRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ConflictException;
import com.clinic.exception.ForbiddenException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.AppointmentMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AppointmentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class AppointmentServiceImpl implements AppointmentService {

    /**
     * Statuses that occupy a doctor's calendar. A cancelled or no-show appointment
     * releases its slot, so it never blocks a new booking.
     */
    private static final List<AppointmentStatus> BLOCKING_STATUSES = List.of(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.COMPLETED
    );

    /**
     * Longest slot the booking rules recognise.
     *
     * <p>Used to pad the conflict-detection window: an appointment that starts just
     * before the slot being booked can still overlap it by running long, so the
     * query has to look back this far.
     */
    private static final int MAX_SLOT_MINUTES = 480;

    /**
     * Bookings are compared at minute precision.
     *
     * <p>Times arrive from `<input type="time">` as whole minutes, so truncating
     * here keeps a 09:30 booking from colliding with 09:30:59 purely because of
     * sub-second clock drift between two requests.
     */
    private static final int PRECISION_MINUTES = 1;

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentMapper appointmentMapper;
    private final CurrentUser currentUser;
    private final AppointmentEventNotifier appointmentEventNotifier;

    public AppointmentServiceImpl(
            AppointmentRepository appointmentRepository,
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            AppointmentMapper appointmentMapper,
            CurrentUser currentUser,
            AppointmentEventNotifier appointmentEventNotifier
    ) {
        this.appointmentRepository = appointmentRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentMapper = appointmentMapper;
        this.currentUser = currentUser;
        this.appointmentEventNotifier = appointmentEventNotifier;
    }

    // =================================================================
    // Write operations
    // =================================================================

    @Override
    public AppointmentResponse create(AppointmentCreateRequest request) {
        String patientId = resolvePatientIdForCreate(request.patientId());

        Patient patient = getPatient(patientId);
        Doctor doctor = getDoctor(request.doctorId());
        AppointmentStatus status = parseStatus(request.status());

        LocalDateTime start = request.appointmentDate();
        int duration = durationMinutes(request.duration());

        assertBookableAt(start, duration);
        assertDoctorNotDoubleBooked(doctor.getId(), start, duration, null);

        Appointment appointment = appointmentMapper.toEntity(request, patient, doctor, status);
        Appointment saved = appointmentRepository.save(appointment);
        log.info("Created appointment id={} patient={} doctor={} at={}", saved.getId(), patientId, doctor.getId(), start);

        // Announced after the save, never before: a request that fails a booking
        // rule or a conflict check must not produce a notification claiming the
        // appointment exists.
        appointmentEventNotifier.onCreated(saved);

        return appointmentMapper.toResponse(saved);
    }

    @Override
    public AppointmentResponse update(String id, AppointmentUpdateRequest request) {
        Appointment appointment = getAccessibleEntityById(id);

        LocalDateTime newStart = request.appointmentDate() != null
                ? request.appointmentDate()
                : appointment.getAppointmentDate();
        int newDuration = request.duration() != null
                ? durationMinutes(request.duration())
                : defaultDuration(appointment.getDuration());
        String newDoctorId = request.doctorId() != null ? request.doctorId() : appointment.getDoctor().getId();

        // Rescheduling into a different slot has to satisfy the same rules as booking.
        if (request.appointmentDate() != null || request.duration() != null || request.doctorId() != null) {
            assertBookableAt(newStart, newDuration);
            assertDoctorNotDoubleBooked(newDoctorId, newStart, newDuration, appointment.getId());
        }

        // The status column is only writable through the dedicated lifecycle
        // endpoints, so the update endpoint cannot resurrect a cancelled booking by
        // smuggling a status in alongside a reschedule.
        if (request.status() != null) {
            throw new BadRequestException(
                    "Appointment status cannot be set through an update. Use the status or cancel action instead.");
        }

        Patient patient = request.patientId() != null ? getPatient(request.patientId()) : null;
        Doctor doctor = request.doctorId() != null ? getDoctor(request.doctorId()) : null;

        // Captured before the update so the notification can say what the
        // appointment moved *from*.
        String previousDate = String.valueOf(appointment.getAppointmentDate());
        boolean timeOrClinicianChanged = request.appointmentDate() != null
                || request.duration() != null
                || request.doctorId() != null;

        appointmentMapper.updateEntity(appointment, request, patient, doctor);
        Appointment saved = appointmentRepository.save(appointment);

        // Only a genuine move is announced. Changing the reason for a visit is an
        // edit, not a reschedule, and telling the care team about it would be
        // noise.
        if (timeOrClinicianChanged) {
            appointmentEventNotifier.onRescheduled(saved, previousDate);
        }

        return appointmentMapper.toResponse(saved);
    }

    @Override
    public AppointmentResponse cancel(String id, String cancellationReason) {
        Appointment appointment = getAccessibleEntityById(id);

        if (appointment.getStatus() == AppointmentStatus.COMPLETED) {
            throw new BadRequestException("A completed appointment cannot be cancelled.");
        }
        if (appointment.getStatus() == AppointmentStatus.CANCELLED) {
            // Already cancelled: report the existing state rather than overwriting
            // the original reason and timestamp with a second one. Returning early
            // also means no second notification: nothing changed.
            return appointmentMapper.toResponse(appointment);
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(cancellationReason);
        appointment.setCancellationDate(LocalDateTime.now());
        appointment.setCancelledBy(currentActorName());
        Appointment saved = appointmentRepository.save(appointment);

        appointmentEventNotifier.onCancelled(saved, cancellationReason);

        return appointmentMapper.toResponse(saved);
    }

    @Override
    public void delete(String id) {
        appointmentRepository.delete(getAccessibleEntityById(id));
    }

    /**
     * The appointment lifecycle, as an explicit graph.
     *
     * <p>Declared rather than inferred so the rules are readable in one place and a
     * new status cannot become reachable by accident.
     *
     * <ul>
     *   <li>{@code SCHEDULED} → confirmed by the front desk, cancelled, or marked
     *       no-show on the day.</li>
     *   <li>{@code CONFIRMED} → completed by the clinician, cancelled, or no-show.</li>
     *   <li>{@code CANCELLED} / {@code NO_SHOW} → {@code SCHEDULED}, so a mistake at
     *       the desk can be undone and the slot reused.</li>
     *   <li>{@code COMPLETED} is terminal: a finished visit is a fact, and correcting
     *       it is a records decision rather than a scheduling one.</li>
     * </ul>
     */
    private static final Map<AppointmentStatus, Set<AppointmentStatus>> ALLOWED_TRANSITIONS = Map.of(
            AppointmentStatus.SCHEDULED, EnumSet.of(
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW),
            AppointmentStatus.CONFIRMED, EnumSet.of(
                    AppointmentStatus.COMPLETED,
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW),
            // A completed visit is not reversible from this screen.
            AppointmentStatus.COMPLETED, EnumSet.noneOf(AppointmentStatus.class),
            AppointmentStatus.CANCELLED, EnumSet.of(AppointmentStatus.SCHEDULED),
            AppointmentStatus.NO_SHOW, EnumSet.of(AppointmentStatus.SCHEDULED)
    );

    @Override
    public AppointmentResponse changeStatus(String id, AppointmentStatusRequest request) {
        Appointment appointment = getAccessibleEntityById(id);
        AppointmentStatus current = appointment.getStatus();
        AppointmentStatus target = request.status();

        if (current == target) {
            // Idempotent: re-sending the current state is a no-op, not an error.
            return appointmentMapper.toResponse(appointment);
        }

        Set<AppointmentStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(target)) {
            throw new BadRequestException(String.format(
                    "An appointment cannot move from %s to %s. Allowed next steps: %s.",
                    current,
                    target,
                    allowed.isEmpty() ? "none" : allowed.stream().map(Enum::name).collect(Collectors.joining(", "))));
        }

        // Completing a visit frees nothing, but confirming one can collide with a
        // booking made while the slot sat in SCHEDULED, so the calendar is checked
        // on every move into a status that occupies the doctor's time.
        if (BLOCKING_STATUSES.contains(target)) {
            assertDoctorNotDoubleBooked(
                    appointment.getDoctor().getId(),
                    appointment.getAppointmentDate(),
                    defaultDuration(appointment.getDuration()),
                    appointment.getId());
        }

        if (target == AppointmentStatus.CANCELLED) {
            // Same bookkeeping as the dedicated cancel action, so an audit cannot
            // tell which endpoint was used to stop a booking.
            appointment.setCancellationReason(request.reason());
            appointment.setCancellationDate(LocalDateTime.now());
            appointment.setCancelledBy(currentActorName());
        } else if (current == AppointmentStatus.CANCELLED) {
            // Undoing a cancellation: drop the fields that described it.
            appointment.setCancellationReason(null);
            appointment.setCancellationDate(null);
            appointment.setCancelledBy(null);
        }

        appointment.setStatus(target);
        log.info("Appointment {} status {} -> {}", id, current, target);
        Appointment saved = appointmentRepository.save(appointment);

        // A cancellation announces as a cancellation even when it arrives through
        // the status endpoint, so the recipient is told why as well as that. The
        // generic status message would have omitted the reason, which is the part
        // a patient or a receptionist actually needs.
        if (target == AppointmentStatus.CANCELLED) {
            appointmentEventNotifier.onCancelled(saved, request.reason());
        } else {
            // The target status is the event discriminator, so a confirmation and a
            // later no-show each produce their own notification instead of the
            // second suppressing the first.
            appointmentEventNotifier.onStatusChanged(saved);
        }

        return appointmentMapper.toResponse(saved);
    }

    // =================================================================
    // Read operations
    // =================================================================

    @Override
    @Transactional(readOnly = true)
    public AppointmentResponse getById(String id) {
        return appointmentMapper.toResponse(getAccessibleEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentResponse> getAll(Pageable pageable) {
        // Same scoping as search: an unfiltered listing must not become a way around
        // the patient/doctor restrictions, so it goes through the one query builder.
        return search(emptySearch(), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentResponse> search(AppointmentSearchRequest request, Pageable pageable) {
        AppointmentSearchRequest scoped = scopeToCaller(request);

        Specification<Appointment> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (scoped.patientId() != null) {
                predicates.add(cb.equal(root.get("patient").get("id"), scoped.patientId()));
            }
            if (scoped.doctorId() != null) {
                predicates.add(cb.equal(root.get("doctor").get("id"), scoped.doctorId()));
            }
            if (scoped.status() != null) {
                predicates.add(cb.equal(root.get("status"), scoped.status()));
            }
            if (scoped.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("appointmentDate"), scoped.from()));
            }
            if (scoped.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("appointmentDate"), scoped.to()));
            }
            if (scoped.keyword() != null && !scoped.keyword().isBlank()) {
                String keyword = "%" + scoped.keyword().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("reasonForVisit")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return appointmentRepository.findAll(specification, pageable).map(appointmentMapper::toResponse);
    }

    // =================================================================
    // Booking rules
    // =================================================================

    /**
     * A booking must start in the future.
     *
     * <p>Reception books forward, and so does every other caller: there is no
     * workflow that legitimately writes an appointment into the past, and a
     * backdated row silently corrupts every "today" and "upcoming" count the
     * dashboards derive from this table.
     */
    private void assertBookableAt(LocalDateTime start, int duration) {
        if (start == null) {
            throw new BadRequestException("Appointment date is required");
        }
        if (start.isBefore(LocalDateTime.now().minusMinutes(PRECISION_MINUTES))) {
            throw new BadRequestException("Appointments cannot be scheduled in the past.");
        }
        if (duration <= 0) {
            throw new BadRequestException("Duration must be a positive number of minutes.");
        }
    }

    /**
     * Rejects a booking that overlaps an existing one for the same doctor.
     *
     * <p>Two half-open intervals overlap when each starts before the other ends, so
     * a booking may begin exactly when the previous one finishes. Cancelled and
     * no-show appointments are excluded, which is what makes a freed slot bookable
     * again.
     *
     * <p>{@code excludeId} skips the appointment being rescheduled, otherwise a
     * booking would collide with its own current slot.
     */
    private void assertDoctorNotDoubleBooked(String doctorId, LocalDateTime start, int duration, String excludeId) {
        LocalDateTime end = start.plusMinutes(duration);
        LocalDateTime windowStart = start.minusMinutes(MAX_SLOT_MINUTES);

        List<Appointment> nearby = appointmentRepository.findBookableInWindow(
                doctorId, windowStart, end, BLOCKING_STATUSES);

        for (Appointment existing : nearby) {
            if (excludeId != null && excludeId.equals(existing.getId())) {
                continue;
            }
            LocalDateTime existingStart = existing.getAppointmentDate();
            LocalDateTime existingEnd = existingStart.plusMinutes(defaultDuration(existing.getDuration()));
            if (existingStart.isBefore(end) && existingEnd.isAfter(start)) {
                throw new ConflictException(String.format(
                        "This doctor is already booked from %s to %s. Choose another time.",
                        existingStart, existingEnd));
            }
        }
    }

    /** Default status for a new booking, and the fallback for a blank request field. */
    private AppointmentStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return AppointmentStatus.SCHEDULED;
        }
        try {
            return AppointmentStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Unknown appointment status '" + raw + "'. Valid values are: "
                    + Arrays.stream(AppointmentStatus.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", ")) + ".");
        }
    }

    private int durationMinutes(Integer requested) {
        if (requested == null) {
            return 30;
        }
        if (requested <= 0) {
            throw new BadRequestException("Duration must be a positive number of minutes.");
        }
        return requested;
    }

    /**
     * Guards against a null duration on a legacy row.
     *
     * <p>The column is NOT NULL, so this never fires on data written through this
     * service; it exists so a malformed legacy row cannot produce a
     * NullPointerException inside the overlap arithmetic.
     */
    private int defaultDuration(Integer duration) {
        return duration == null || duration <= 0 ? 30 : duration;
    }

    // =================================================================
    // Record-level authorisation
    // =================================================================

    /**
     * Applies the caller's own scope to a search.
     *
     * <p>A patient may only ever list their own appointments and a doctor only
     * their own panel, whatever filters the request carried. Front-desk and
     * administrative roles are clinic-wide, so their filters pass through
     * untouched.
     *
     * <p>Overwriting rather than intersecting is deliberate: it is the only way to
     * guarantee that {@code ?patientId=someone-else} cannot widen the result set.
     */
    private AppointmentSearchRequest scopeToCaller(AppointmentSearchRequest request) {
        AppointmentSearchRequest effective = request != null ? request : emptySearch();
        UserRole role = currentUser.role();

        if (role == UserRole.PATIENT) {
            return new AppointmentSearchRequest(currentUser.userId(), null, effective.status(),
                    effective.from(), effective.to(), effective.keyword());
        }
        if (role == UserRole.DOCTOR) {
            return new AppointmentSearchRequest(effective.patientId(), currentUser.userId(), effective.status(),
                    effective.from(), effective.to(), effective.keyword());
        }
        return effective;
    }

    /**
     * Loads an appointment the caller is allowed to act on.
     *
     * <p>Authorisation is decided against the caller's identity, never against an
     * id in the path, so knowing someone else's appointment id is not enough to
     * open it.
     */
    private Appointment getAccessibleEntityById(String id) {
        Appointment appointment = getEntityById(id);
        UserRole role = currentUser.role();

        if (role == UserRole.PATIENT && !currentUser.userId().equals(appointment.getPatient().getId())) {
            throw new ForbiddenException("You may only access your own appointments");
        }
        if (role == UserRole.DOCTOR && !currentUser.userId().equals(appointment.getDoctor().getId())) {
            throw new ForbiddenException("You may only access appointments assigned to you");
        }
        return appointment;
    }

    /**
     * A patient books for themselves.
     *
     * <p>{@code appointment:manage} is what lets a patient reach the endpoint at
     * all; this is what stops them reaching it on someone else's behalf.
     */
    private String resolvePatientIdForCreate(String requestedPatientId) {
        if (requestedPatientId == null || requestedPatientId.isBlank()) {
            throw new BadRequestException("Patient ID is required");
        }
        if (currentUser.role() == UserRole.PATIENT && !currentUser.userId().equals(requestedPatientId)) {
            throw new ForbiddenException("You may only book appointments for yourself");
        }
        return requestedPatientId;
    }

    /** Recorded on the appointment so an audit can name who cancelled it. */
    private String currentActorName() {
        return currentUser.role().name();
    }

    // =================================================================
    // Lookup helpers
    // =================================================================

    private AppointmentSearchRequest emptySearch() {
        return new AppointmentSearchRequest(null, null, null, null, null, null);
    }

    private Appointment getEntityById(String id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found: " + id));
    }

    private Patient getPatient(String id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
    }

    private Doctor getDoctor(String id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + id));
    }
}