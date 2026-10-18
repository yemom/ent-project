package com.clinic.service.impl;

import com.clinic.dto.request.MedicalRecordAmendRequest;
import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordAmendmentResponse;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.dto.response.MyMedicalRecordResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.Doctor;
import com.clinic.entity.MedicalRecord;
import com.clinic.entity.MedicalRecordAmendment;
import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ForbiddenException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.MedicalRecordMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.MedicalRecordAmendmentRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.MedicalRecordService;
import com.clinic.service.OwnRecordFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional
@Slf4j
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final MedicalRecordAmendmentRepository amendmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordMapper medicalRecordMapper;
    private final CurrentUser currentUser;

    public MedicalRecordServiceImpl(
            MedicalRecordRepository medicalRecordRepository,
            MedicalRecordAmendmentRepository amendmentRepository,
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            MedicalRecordMapper medicalRecordMapper,
            CurrentUser currentUser
    ) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.amendmentRepository = amendmentRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordMapper = medicalRecordMapper;
        this.currentUser = currentUser;
    }

    @Override
    public MedicalRecordResponse create(MedicalRecordCreateRequest request) {
        Patient patient = getPatient(request.patientId());
        // The author is taken from the JWT when present; a patientId/doctorId in
        // the body can never let one doctor write as another.
        Doctor doctor = resolveAuthor(request.doctorId());
        Appointment appointment = request.appointmentId() != null ? getAppointment(request.appointmentId()) : null;

        MedicalRecord record = medicalRecordMapper.toEntity(request, patient, doctor, appointment);
        record.setSignedAt(null);
        record.setVersion(1);

        MedicalRecord saved = medicalRecordRepository.save(record);
        log.info("Created medical record id={}", saved.getId());
        return medicalRecordMapper.toResponse(saved);
    }

    @Override
    public MedicalRecordResponse update(String id, MedicalRecordUpdateRequest request) {
        MedicalRecord record = getEntityById(id);
        if (record.isSigned()) {
            throw new BadRequestException(
                    "This record is signed and cannot be updated directly; submit an amendment instead");
        }
        Patient patient = request.patientId() != null ? getPatient(request.patientId()) : null;
        Doctor doctor = request.doctorId() != null ? getDoctor(request.doctorId()) : null;
        Appointment appointment = request.appointmentId() != null ? getAppointment(request.appointmentId()) : null;
        medicalRecordMapper.updateEntity(record, request, patient, doctor, appointment);
        return medicalRecordMapper.toResponse(medicalRecordRepository.save(record));
    }

    @Override
    public MedicalRecordResponse amend(String id, MedicalRecordAmendRequest request) {
        MedicalRecord record = getEntityById(id);

        // Capture the pre-change values so history is reconstructable.
        Map<String, String> previous = snapshot(record);
        Map<String, String> updated = applyAmendment(record, request);

        Map<String, String> changedPrevious = new LinkedHashMap<>();
        Map<String, String> changedNext = new LinkedHashMap<>();
        List<String> changedFields = new ArrayList<>();
        updated.forEach((field, newValue) -> {
            String oldValue = previous.get(field);
            if (!java.util.Objects.equals(oldValue, newValue)) {
                changedFields.add(field);
                changedPrevious.put(field, oldValue);
                changedNext.put(field, newValue);
            }
        });

        if (changedFields.isEmpty()) {
            log.debug("Amendment for record {} changed no fields; skipping history row", id);
            return medicalRecordMapper.toResponse(record);
        }

        MedicalRecordAmendment amendment = MedicalRecordAmendment.builder()
                .medicalRecordId(id)
                .amendedById(currentUser.userId())
                .amendedByName(currentUser.require().getUsername())
                .reason(request.reason())
                .previousValues(render(changedPrevious))
                .newValues(render(changedNext))
                .amendedAt(LocalDateTime.now())
                .fields(changedFields)
                .build();

        amendmentRepository.save(amendment);
        medicalRecordRepository.save(record);

        log.info("Amended medical record id={} fields={}", id, changedFields);
        return medicalRecordMapper.toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getById(String id) {
        return medicalRecordMapper.toResponse(getEntityById(id));
    }

    /**
     * Read with the ownership rule applied.
     *
     * <p>{@code users} is a single-table hierarchy, so a PATIENT-role account and
     * its {@link Patient} profile are the same row and therefore the same id. That
     * identity mapping is what makes {@code own_record:read} safe to grant: there is
     * no separate "patient profile id" that could drift from the signed-in user.
     */
    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getByIdForCaller(String id) {
        MedicalRecord record = getEntityById(id);
        if (currentUser.is(UserRole.PATIENT)
                && !currentUser.userId().equals(record.getPatient().getId())) {
            // 403 rather than 404: the record exists, the caller simply may not have
            // it. Collapsing to 404 would also hide genuine typos from the clinician.
            throw new ForbiddenException("You may only access your own medical records");
        }
        return medicalRecordMapper.toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> getAll(Pageable pageable) {
        return medicalRecordRepository.findAll(pageable).map(medicalRecordMapper::toResponse);
    }

    /**
     * The caller's own records.
     *
     * <p>The owning id comes from {@link CurrentUser#userId()} and is prepended to
     * the caller's filter as an unconditional predicate, so no combination of query
     * parameters can produce a row belonging to somebody else.
     */
    @Override
    @Transactional(readOnly = true)
    public Page<MyMedicalRecordResponse> getOwnRecords(OwnRecordFilter filter, Pageable pageable) {
        String callerId = currentUser.userId();
        OwnRecordFilter effective = filter != null ? filter : OwnRecordFilter.of();

        Specification<MedicalRecord> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Ownership is not a filter the caller can turn off.
            predicates.add(cb.equal(root.get("patient").get("id"), callerId));
            if (effective.fromDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("recordDate"), effective.fromDate()));
            }
            if (effective.toDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("recordDate"), effective.toDate()));
            }
            if (effective.keyword() != null) {
                String keyword = "%" + effective.keyword().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("diagnosis")), keyword),
                        cb.like(cb.lower(root.get("treatment")), keyword),
                        cb.like(cb.lower(root.get("prescription")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return medicalRecordRepository.findAll(specification, pageable).map(this::toOwnResponse);
    }

    /**
     * Projects a record onto the patient's view.
     *
     * <p>Reads the entity rather than the clinician response so the excluded fields
     * are never materialised in the first place.
     */
    private MyMedicalRecordResponse toOwnResponse(MedicalRecord record) {
        return new MyMedicalRecordResponse(
                record.getId(),
                record.getRecordDate(),
                record.getMedicalRecordType(),
                record.getDiagnosis(),
                record.getTreatment(),
                record.getPrescription(),
                record.getTestResults(),
                record.getFollowUpRequired(),
                record.getFollowUpDate(),
                record.getNotes(),
                record.getDoctor() != null ? record.getDoctor().getFullName() : null,
                record.getSignedAt() != null
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> search(MedicalRecordSearchRequest request, Pageable pageable) {
        Specification<MedicalRecord> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (request.patientId() != null) {
                predicates.add(cb.equal(root.get("patient").get("id"), request.patientId()));
            }
            if (request.doctorId() != null) {
                predicates.add(cb.equal(root.get("doctor").get("id"), request.doctorId()));
            }
            if (request.appointmentId() != null) {
                predicates.add(cb.equal(root.get("appointment").get("id"), request.appointmentId()));
            }
            if (request.fromDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("recordDate"), request.fromDate()));
            }
            if (request.toDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("recordDate"), request.toDate()));
            }
            if (request.confidential() != null) {
                predicates.add(cb.equal(root.get("isConfidential"), request.confidential()));
            }
            if (request.keyword() != null && !request.keyword().isBlank()) {
                String keyword = "%" + request.keyword().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("diagnosis")), keyword),
                        cb.like(cb.lower(root.get("treatment")), keyword),
                        cb.like(cb.lower(root.get("prescription")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return medicalRecordRepository.findAll(specification, pageable).map(medicalRecordMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordAmendmentResponse> amendmentHistory(String medicalRecordId) {
        return amendmentRepository.findByMedicalRecordIdOrderByCreatedAtDesc(medicalRecordId).stream()
                .map(MedicalRecordAmendmentResponse::from)
                .toList();
    }

    @Override
    public MedicalRecordResponse sign(String id) {
        MedicalRecord record = getEntityById(id);
        record.sign(currentUser.userId());
        log.info("Signed medical record id={}", id);
        return medicalRecordMapper.toResponse(medicalRecordRepository.save(record));
    }

    @Override
    public void delete(String id) {
        medicalRecordRepository.delete(getEntityById(id));
    }

    // ---------------- helpers ----------------

    /**
     * Resolves the record's author. A doctor may only author as themselves, so a
     * doctorId in the body that differs from the caller is rejected rather than
     * trusted.
     */
    private Doctor resolveAuthor(String requestedDoctorId) {
        if (currentUser.is(com.clinic.entity.UserRole.DOCTOR)) {
            Doctor self = doctorRepository.findById(currentUser.userId())
                    .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + currentUser.userId()));
            if (requestedDoctorId != null && !requestedDoctorId.equals(self.getId())) {
                throw new BadRequestException("A doctor may only author records under their own id");
            }
            return self;
        }
        return requestedDoctorId != null ? getDoctor(requestedDoctorId) : null;
    }

    private Map<String, String> snapshot(MedicalRecord record) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("diagnosis", record.getDiagnosis());
        values.put("treatment", record.getTreatment());
        values.put("prescription", record.getPrescription());
        values.put("testResults", record.getTestResults());
        values.put("vitalSigns", record.getVitalSigns());
        values.put("notes", record.getNotes());
        values.put("followUpRequired", String.valueOf(record.getFollowUpRequired()));
        values.put("followUpDate", record.getFollowUpDate() != null ? record.getFollowUpDate().toString() : null);
        values.put("medicalRecordType", record.getMedicalRecordType());
        values.put("isConfidential", String.valueOf(record.getIsConfidential()));
        return values;
    }

    private Map<String, String> applyAmendment(MedicalRecord record, MedicalRecordAmendRequest request) {
        Map<String, String> values = new LinkedHashMap<>();
        if (request.diagnosis() != null) {
            record.setDiagnosis(request.diagnosis());
        }
        if (request.treatment() != null) {
            record.setTreatment(request.treatment());
        }
        if (request.prescription() != null) {
            record.setPrescription(request.prescription());
        }
        if (request.testResults() != null) {
            record.setTestResults(request.testResults());
        }
        if (request.vitalSigns() != null) {
            record.setVitalSigns(request.vitalSigns());
        }
        if (request.notes() != null) {
            record.setNotes(request.notes());
        }
        if (request.followUpRequired() != null) {
            record.setFollowUpRequired(request.followUpRequired());
        }
        if (request.followUpDate() != null) {
            record.setFollowUpDate(request.followUpDate());
        }
        if (request.medicalRecordType() != null) {
            record.setMedicalRecordType(request.medicalRecordType());
        }
        if (request.confidential() != null) {
            record.setIsConfidential(request.confidential());
        }
        values.putAll(snapshot(record));
        return values;
    }

    private String render(Map<String, String> values) {
        return values.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + (entry.getValue() == null ? "" : entry.getValue()))
                .collect(java.util.stream.Collectors.joining("; "));
    }

    private MedicalRecord getEntityById(String id) {
        return medicalRecordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found: " + id));
    }

    private Patient getPatient(String id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
    }

    private Doctor getDoctor(String id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + id));
    }

    private Appointment getAppointment(String id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found: " + id));
    }
}