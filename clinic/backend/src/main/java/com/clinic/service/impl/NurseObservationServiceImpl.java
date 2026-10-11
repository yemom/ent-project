package com.clinic.service.impl;

import com.clinic.dto.request.NurseObservationRequest;
import com.clinic.dto.response.NurseObservationResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.NurseObservation;
import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.NurseObservationRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuditLogService;
import com.clinic.service.NurseObservationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Nursing observations.
 *
 * <p>A nurse may only chart against — and read — a patient the front desk
 * allocated to them. Both the read and the write check run against the active
 * rows of {@code patient_assignments}, the same rows that build the nursing and
 * doctor panels, so "assigned to me" cannot mean one thing on the dashboard and
 * another on the write endpoint.
 */
@Service
@Transactional
@Slf4j
public class NurseObservationServiceImpl implements NurseObservationService {

    private final NurseObservationRepository observationRepository;
    private final PatientRepository patientRepository;
    private final PatientAssignmentRepository assignmentRepository;
    private final CurrentUser currentUser;
    private final AuditLogService auditLogService;

    public NurseObservationServiceImpl(NurseObservationRepository observationRepository,
                                      PatientRepository patientRepository,
                                      PatientAssignmentRepository assignmentRepository,
                                      CurrentUser currentUser,
                                      AuditLogService auditLogService) {
        this.observationRepository = observationRepository;
        this.patientRepository = patientRepository;
        this.assignmentRepository = assignmentRepository;
        this.currentUser = currentUser;
        this.auditLogService = auditLogService;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NurseObservationResponse> list(String patientId, NurseObservation.Kind kind,
                                                       Pageable pageable) {
        Page<NurseObservation> page;
        if (patientId == null || patientId.isBlank()) {
            // No filter requested: return the caller's own panel, not the whole
            // hospital's chart. Scoping in SQL (rather than filtering the response)
            // keeps pagination totals honest and never over-fetches clinical data.
            List<String> patientIds = assignedPatientIds();
            if (patientIds.isEmpty()) {
                return PageResponse.of(Page.empty(pageable));
            }
            page = kind != null
                    ? observationRepository.findByPatientIdInAndKind(patientIds, kind, pageable)
                    : observationRepository.findByPatientIdIn(patientIds, pageable);
        } else {
            // An explicit patient must still be one the caller is responsible for.
            assertAssigned(patientId);
            page = kind != null
                    ? observationRepository.findByPatientIdAndKind(patientId, kind, pageable)
                    : observationRepository.findByPatientId(patientId, pageable);
        }
        return PageResponse.of(page.map(NurseObservationResponse::from));
    }

    /**
     * Patient ids on the caller's active panel, derived from the JWT id.
     *
     * <p>Nurses are scoped by the nurse column, doctors by the doctor column —
     * the same split the nursing and doctor panels use, so "the patients I can see"
     * and "the observations I can read" stay identical.
     */
    private List<String> assignedPatientIds() {
        String callerId = currentUser.userId();
        Page<com.clinic.entity.PatientAssignment> assignments = currentUser.is(UserRole.NURSE)
                ? assignmentRepository.findByNurseIdAndReleasedAtIsNull(callerId, Pageable.unpaged())
                : assignmentRepository.findByDoctorIdAndReleasedAtIsNull(callerId, Pageable.unpaged());

        return assignments.getContent()
                .stream()
                .map(assignment -> assignment.getPatient() != null ? assignment.getPatient().getId() : null)
                .filter(Objects::nonNull)
                .toList();
    }

    @Override
    public NurseObservationResponse record(NurseObservationRequest request) {
        NurseObservation.Kind kind = parseKind(request.kind());

        Patient patient = patientRepository.findById(request.patientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + request.patientId()));

        assertAssigned(patient.getId());

        // Reject an observation that carries no clinical content at all — an empty
        // row is worse than no row because it looks like an observation happened.
        boolean hasVitals = request.bloodPressure() != null || request.heartRate() != null
                || request.temperatureC() != null || request.respiratoryRate() != null
                || request.oxygenSaturation() != null || request.weightKg() != null;
        boolean hasMedication = kind == NurseObservation.Kind.MEDICATION_ADMINISTRATION
                && request.medication() != null && !request.medication().isBlank();
        boolean hasNotes = request.notes() != null && !request.notes().isBlank();

        if (kind == NurseObservation.Kind.MEDICATION_ADMINISTRATION) {
            if (!hasMedication) {
                throw new BadRequestException("A medication administration record must name the medication");
            }
        } else if (!hasVitals && !hasNotes) {
            throw new BadRequestException(
                    "Record at least one vital sign or a nursing note — an empty observation is not stored");
        }

        NurseObservation observation = NurseObservation.builder()
                .patient(patient)
                .recordedById(currentUser.userId())
                .recordedByName(currentUser.require().getUsername())
                .kind(kind)
                .bloodPressure(request.bloodPressure())
                .heartRate(request.heartRate())
                .temperatureC(request.temperatureC())
                .respiratoryRate(request.respiratoryRate())
                .oxygenSaturation(request.oxygenSaturation())
                .weightKg(request.weightKg())
                .medication(request.medication())
                .dose(request.dose())
                .notes(request.notes())
                .observedAt(LocalDateTime.now())
                .build();

        NurseObservation saved = observationRepository.save(observation);
        log.info("Recorded {} observation for patient {} by {}", kind, patient.getId(), currentUser.userId());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "NURSE_OBSERVATION",
                saved.getId(), kind + " recorded for patient " + patient.getId());
        return NurseObservationResponse.from(saved);
    }

    @Override
    public void delete(String id) {
        NurseObservation observation = observationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Observation not found: " + id));

        // Only the recorder can retract their own entry; this is a correction
        // affordance, not a way for one nurse to erase another's chart note.
        if (!observation.getRecordedById().equals(currentUser.userId())) {
            throw new BadRequestException("Only the nurse who recorded this observation can remove it");
        }

        observationRepository.delete(observation);
        log.info("Deleted nurse observation id={}", id);
    }

    // ================= helpers =================

    /**
     * A nurse may only chart against a patient the front desk allocated to them.
     *
     * <p>Scoped by the same active assignment rows the nursing panel is built from,
     * so "my patients" and "what I may write" cannot drift apart. A doctor, who
     * also holds {@code vital:write} through the read rule, is scoped by the doctor
     * column instead — a clinician is never blocked from charting a patient they
     * are responsible for.
     */
    private void assertAssigned(String patientId) {
        String callerId = currentUser.userId();
        boolean assigned = currentUser.is(UserRole.NURSE)
                ? assignmentRepository.existsByPatientIdAndNurseIdAndReleasedAtIsNull(patientId, callerId)
                : assignmentRepository.existsByPatientIdAndDoctorIdAndReleasedAtIsNull(patientId, callerId);

        if (!assigned) {
            throw new BadRequestException("This patient is not assigned to you");
        }
    }

    private NurseObservation.Kind parseKind(String value) {
        try {
            return NurseObservation.Kind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BadRequestException(
                    "kind must be one of VITALS, NURSING_NOTE, MEDICATION_ADMINISTRATION");
        }
    }
}