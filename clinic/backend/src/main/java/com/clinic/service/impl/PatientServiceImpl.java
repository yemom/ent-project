package com.clinic.service.impl;

import com.clinic.dto.request.AssignPatientRequest;
import com.clinic.dto.request.CheckInPatientRequest;
import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.request.RegisterPatientRequest;
import com.clinic.dto.response.PatientAssignmentResponse;
import com.clinic.dto.response.PatientDemographicsResponse;
import com.clinic.dto.response.PatientResponse;
import com.clinic.entity.*;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.PatientMapper;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuditLogService;
import com.clinic.service.NotificationService;
import com.clinic.service.PatientService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class PatientServiceImpl implements PatientService {

    private static final String FRONT_DESK_LINK = "/reception";

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PatientAssignmentRepository assignmentRepository;
    private final PatientMapper patientMapper;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public PatientServiceImpl(
            PatientRepository patientRepository,
            UserRepository userRepository,
            DoctorRepository doctorRepository,
            PatientAssignmentRepository assignmentRepository,
            PatientMapper patientMapper,
            PasswordEncoder passwordEncoder,
            CurrentUser currentUser,
            NotificationService notificationService,
            AuditLogService auditLogService
    ) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.assignmentRepository = assignmentRepository;
        this.patientMapper = patientMapper;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
    }

    // ================= existing behaviour =================

    @Override
    public PatientResponse create(PatientCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }
        Patient patient = patientMapper.toEntity(request, passwordEncoder.encode(request.password()));
        Patient saved = patientRepository.save(patient);
        log.info("Created patient id={}", saved.getId());
        return patientMapper.toResponse(saved);
    }

    @Override
    public PatientResponse update(String id, PatientUpdateRequest request) {
        Patient patient = getEntityById(id);
        patientMapper.updateEntity(patient, request);
        return patientMapper.toResponse(patientRepository.save(patient));
    }

    @Override
    @Transactional(readOnly = true)
    public PatientResponse getById(String id) {
        return patientMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientResponse> getAll(Pageable pageable) {
        return patientRepository.findAll(branchScoped(null), pageable).map(patientMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientResponse> search(String fullName, String email, String phone, Boolean active,
                                        Pageable pageable) {
        Specification<Patient> specification = branchScoped(
                (root, query, cb) -> {
                    ArrayList<Predicate> predicates = new ArrayList<>();
                    if (fullName != null && !fullName.isBlank()) {
                        predicates.add(cb.like(cb.lower(root.get("fullName")), "%" + fullName.toLowerCase() + "%"));
                    }
                    if (email != null && !email.isBlank()) {
                        predicates.add(cb.like(cb.lower(root.get("email")), "%" + email.toLowerCase() + "%"));
                    }
                    if (phone != null && !phone.isBlank()) {
                        predicates.add(cb.like(cb.lower(root.get("phone")), "%" + phone.toLowerCase() + "%"));
                    }
                    if (active != null) {
                        predicates.add(cb.equal(root.get("active"), active));
                    }
                    return cb.and(predicates.toArray(new Predicate[0]));
                });
        return patientRepository.findAll(specification, pageable).map(patientMapper::toResponse);
    }

    /**
     * Restricts a specification to the caller's branch.
     *
     * <p>The branch comes from the authenticated user, never from the request. A
     * platform super admin (no branch set) is intentionally unscoped; anyone else
     * sees only their own branch.
     */
    private Specification<Patient> branchScoped(Specification<Patient> filter) {
        String branchId = currentUser.isBranchScoped() ? currentUser.branchId() : null;
        if (branchId == null) {
            return filter != null ? filter : (root, query, cb) -> cb.conjunction();
        }
        Specification<Patient> branchPredicate =
                (root, query, cb) -> cb.equal(root.get("branchId"), branchId);
        return filter != null ? branchPredicate.and(filter) : branchPredicate;
    }

    @Override
    public void delete(String id) {
        patientRepository.delete(getEntityById(id));
    }

    // ================= front desk =================

    @Override
    public PatientDemographicsResponse registerAtFrontDesk(RegisterPatientRequest request) {
        Optional<Patient> existing = userRepository.findByEmail(request.email())
                .filter(Patient.class::isInstance)
                .map(Patient.class::cast);

        Patient patient = existing.orElseGet(() -> createNewPatient(request));

        // Demographics refresh is allowed even for existing patients.
        if (request.fullName() != null && !request.fullName().isBlank()) {
            patient.setFullName(request.fullName());
        }
        if (request.phone() != null) {
            patient.setPhone(request.phone());
        }
        if (request.dateOfBirth() != null && !request.dateOfBirth().isBlank()) {
            patient.setDateOfBirth(parseDate(request.dateOfBirth()));
        }
        if (request.gender() != null && !request.gender().isBlank()) {
            patient.setGender(parseGender(request.gender()));
        }
        if (request.bloodType() != null) {
            patient.setBloodType(request.bloodType());
        }
        if (request.emergencyContactName() != null) {
            patient.setEmergencyContactName(request.emergencyContactName());
        }
        if (request.emergencyContactPhone() != null) {
            patient.setEmergencyContactPhone(request.emergencyContactPhone());
        }
        if (request.branchId() != null && !request.branchId().isBlank()) {
            patient.setBranchId(request.branchId());
        }
        if (request.registrationNumber() != null && !request.registrationNumber().isBlank()) {
            patient.setRegistrationNumber(request.registrationNumber());
        } else if (patient.getRegistrationNumber() == null) {
            patient.setRegistrationNumber(generateRegistrationNumber());
        }

        Patient saved = patientRepository.save(patient);
        log.info("Registered patient at front desk id={} registrationNumber={}",
                saved.getId(), saved.getRegistrationNumber());
        auditLogService.record(AuditAction.RECORD_CREATED, "PATIENT", saved.getId(), "Front desk registration");
        return toDemographics(saved);
    }

    @Override
    public PatientDemographicsResponse checkIn(String patientId, CheckInPatientRequest request) {
        Patient patient = getEntityById(patientId);

        final boolean checkedIn = request.checkedIn() != null && request.checkedIn();
        patient.setCheckedInAt(checkedIn ? LocalDateTime.now() : null);

        final Integer queuePosition = request.queuePosition() != null
                ? request.queuePosition()
                : (checkedIn ? nextQueuePosition() : null);

        Patient saved = patientRepository.save(patient);

        if (queuePosition != null) {
            // Reflect the queue position on the active assignment, when there is one.
            assignmentRepository.findByPatientIdAndReleasedAtIsNull(patientId)
                    .ifPresent(assignment -> {
                        assignment.setQueuePosition(queuePosition);
                        assignmentRepository.save(assignment);
                    });
        }

        log.info("Patient {} checkedIn={} queuePosition={}", patientId, checkedIn, queuePosition);
        auditLogService.record(AuditAction.RECORD_VIEWED, "PATIENT", patientId,
                checkedIn ? "Checked in" : "Checked out");
        return toDemographics(saved);
    }

    @Override
    public PatientAssignmentResponse assignToDoctor(String patientId, AssignPatientRequest request) {
        Patient patient = getEntityById(patientId);
        Doctor doctor = doctorRepository.findById(request.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + request.doctorId()));

        if (!Boolean.TRUE.equals(doctor.getActive())) {
            throw new BadRequestException("Cannot assign to an inactive doctor");
        }

        // Reassigning releases the previous active row rather than deleting it,
        // so the care chain stays auditable.
        assignmentRepository.findByPatientIdAndReleasedAtIsNull(patientId)
                .ifPresent(existing -> {
                    if (existing.getDoctor() != null && existing.getDoctor().getId().equals(doctor.getId())) {
                        return;
                    }
                    existing.release();
                    assignmentRepository.save(existing);
                });

        PatientAssignment assignment = PatientAssignment.builder()
                .patient(patient)
                .doctor(doctor)
                .nurseId(validateNurse(request.nurseId()))
                .departmentId(request.departmentId() != null ? request.departmentId() : doctor.getSpecialization())
                .queuePosition(nextQueuePosition())
                .assignedById(currentUser.userId())
                .assignedByName(currentUser.require().getUsername())
                .assignedAt(LocalDateTime.now())
                .reason(request.reason())
                .build();

        PatientAssignment saved = assignmentRepository.save(assignment);
        log.info("Assigned patient {} to doctor {} (nurse={})", patientId, doctor.getId(), saved.getNurseId());
        auditLogService.record(AuditAction.PATIENT_ASSIGNED, "PATIENT", patientId,
                "Assigned to doctor " + doctor.getFullName());

        // The assigned doctor is notified. Keyed on the assignment, so re-saving the
        // same assignment — a retry, or a receptionist pressing Assign twice — does
        // not stack identical rows in the doctor's bell.
        notificationService.createForUserOnce(
                doctor.getId(),
                NotificationType.PATIENT_ASSIGNED,
                "New patient assigned",
                String.format("%s has been assigned to you by %s.",
                        patient.getFullName(), currentUser.require().getUsername()),
                patientId,
                "/doctor/patients/" + patientId,
                NotificationType.PATIENT_ASSIGNED.name(),
                saved.getId());

        // So is the assigned nurse, so the nursing panel is not a silent gap.
        if (saved.getNurseId() != null) {
            notificationService.createForUserOnce(
                    saved.getNurseId(),
                    NotificationType.PATIENT_ASSIGNED,
                    "New patient assigned",
                    String.format("%s has been assigned to you by %s.",
                            patient.getFullName(), currentUser.require().getUsername()),
                    patientId,
                    "/nurse/patients",
                    NotificationType.PATIENT_ASSIGNED.name(),
                    saved.getId());
        }

        return PatientAssignmentResponse.from(saved);
    }

    /**
     * A named nurse must be an active NURSE account.
     *
     * <p>Without this check any user id could be written into the nursing panel,
     * so a compromised receptionist account could expose a patient's observations
     * to an unrelated user by naming them as the nurse.
     */
    private String validateNurse(String nurseId) {
        if (nurseId == null || nurseId.isBlank()) {
            return null;
        }
        var nurse = userRepository.findById(nurseId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Nurse not found: " + nurseId));
        if (nurse.getRole() != UserRole.NURSE) {
            throw new BadRequestException("The assigned user is not a nurse");
        }
        if (!Boolean.TRUE.equals(nurse.getActive())) {
            throw new BadRequestException("Cannot assign a patient to an inactive nurse");
        }
        return nurse.getId();
    }

    @Override
    public PatientAssignmentResponse releaseAssignment(String patientId) {
        PatientAssignment assignment = assignmentRepository.findByPatientIdAndReleasedAtIsNull(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("No active assignment for patient: " + patientId));
        assignment.release();
        return PatientAssignmentResponse.from(assignmentRepository.save(assignment));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PatientAssignmentResponse> assignmentHistory(String patientId) {
        return assignmentRepository.findByPatientIdOrderByAssignedAtDesc(patientId).stream()
                .map(PatientAssignmentResponse::from)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientDemographicsResponse> patientsAssignedTo(String doctorId, Pageable pageable) {
        // Scoped by the assignment table, so a doctor only ever sees their own panel.
        return assignmentRepository.findByDoctorIdAndReleasedAtIsNull(doctorId, pageable)
                .map(assignment -> toDemographics(assignment.getPatient()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientDemographicsResponse> patientsAssignedToNurse(String nurseId, Pageable pageable) {
        // Same assignment table, nurse column: a nurse only ever sees their own panel.
        return assignmentRepository.findByNurseIdAndReleasedAtIsNull(nurseId, pageable)
                .map(assignment -> toDemographics(assignment.getPatient()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> availableNurses() {
        return userRepository.findAllByRoleInAndActiveTrue(List.of(UserRole.NURSE));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Doctor> availableDoctors(String departmentId) {
        return doctorRepository.findAllByRoleInAndActiveTrueAndAvailableTrue(List.of(UserRole.DOCTOR)).stream()
                .filter(doctor -> departmentId == null || departmentId.isBlank()
                        || departmentId.equals(doctor.getSpecialization()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PatientDemographicsResponse getDemographics(String patientId) {
        return toDemographics(getEntityById(patientId));
    }

    // ================= helpers =================

    private Patient createNewPatient(RegisterPatientRequest request) {
        String rawPassword = request.password() != null && !request.password().isBlank()
                ? request.password()
                : generateTemporaryPassword();

        Patient patient = Patient.builder()
                .email(request.email())
                .password(passwordEncoder.encode(rawPassword))
                .fullName(request.fullName())
                .phone(request.phone())
                .role(UserRole.PATIENT)
                .active(true)
                .build();
        patient.setRegistrationNumber(
                request.registrationNumber() != null && !request.registrationNumber().isBlank()
                        ? request.registrationNumber()
                        : generateRegistrationNumber());
        return patient;
    }

    private PatientDemographicsResponse toDemographics(Patient patient) {
        Optional<PatientAssignment> active = assignmentRepository.findByPatientIdAndReleasedAtIsNull(patient.getId());
        String assignedDoctorId = active.map(a -> a.getDoctor() != null ? a.getDoctor().getId() : null).orElse(null);
        String assignedDoctorName = active.map(a -> a.getDoctor() != null ? a.getDoctor().getFullName() : null).orElse(null);

        return new PatientDemographicsResponse(
                patient.getId(),
                patient.getRegistrationNumber(),
                patient.getFullName(),
                patient.getEmail(),
                patient.getPhone(),
                patient.getDateOfBirth(),
                patient.getGender() != null ? patient.getGender().name() : null,
                patient.getBloodType(),
                patient.getEmergencyContactName(),
                patient.getEmergencyContactPhone(),
                patient.getBranchId(),
                patient.isCheckedIn(),
                patient.getCheckedInAt() != null ? patient.getCheckedInAt().toString() : null,
                assignedDoctorId,
                assignedDoctorName
        );
    }

    private int nextQueuePosition() {
        long active = assignmentRepository.countByDoctorIdAndReleasedAtIsNull(currentUser.userId());
        // Cheap monotonic-enough slot; the unique index is on the assignment row,
        // not the position, so a collision only reorders the display list.
        return (int) (active + 1);
    }

    private String generateRegistrationNumber() {
        return "REG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * Front-desk accounts get a random password so nobody can log in with a
     * guessed value; the patient uses password reset to claim the account.
     */
    private String generateTemporaryPassword() {
        return UUID.randomUUID().toString();
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (Exception e) {
            throw new BadRequestException("dateOfBirth must be an ISO date (yyyy-MM-dd)");
        }
    }

    private Gender parseGender(String value) {
        try {
            return Gender.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("gender must be one of MALE, FEMALE, OTHER");
        }
    }

    private Patient getEntityById(String id) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
        // Branch scoping also guards single-record reads, so a guessed id from
        // another branch resolves as "not found" rather than leaking data.
        if (currentUser.isBranchScoped()
                && !currentUser.branchId().equals(patient.getBranchId())) {
            throw new ResourceNotFoundException("Patient not found: " + id);
        }
        return patient;
    }
}