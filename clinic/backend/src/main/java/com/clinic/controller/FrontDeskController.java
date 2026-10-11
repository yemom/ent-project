package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.AssignPatientRequest;
import com.clinic.dto.request.CheckInPatientRequest;
import com.clinic.dto.request.RegisterPatientRequest;
import com.clinic.dto.response.DoctorResponse;
import com.clinic.dto.response.PatientAssignmentResponse;
import com.clinic.dto.response.PatientDemographicsResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.UserRole;
import com.clinic.mapper.DoctorMapper;
import com.clinic.security.CurrentUser;
import com.clinic.service.PatientService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Front-desk API: registration, check-in/queue, and assigning a patient to a
 * doctor. Demographics only — there is no clinical endpoint here, and the
 * receptionist role holds no diagnosis or prescription permission.
 */
@RestController
@RequestMapping(ApiPaths.FRONT_DESK)
@Slf4j
public class FrontDeskController {

    private final PatientService patientService;
    private final DoctorMapper doctorMapper;
    private final CurrentUser currentUser;

    public FrontDeskController(PatientService patientService, DoctorMapper doctorMapper, CurrentUser currentUser) {
        this.patientService = patientService;
        this.doctorMapper = doctorMapper;
        this.currentUser = currentUser;
    }

    @PostMapping("/patients")
    @PreAuthorize("hasAuthority('PERM_patient:register')")
    public ResponseEntity<PatientDemographicsResponse> register(
            @Valid @RequestBody RegisterPatientRequest request) {
        log.info("Front desk registering patient email={}", request.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.registerAtFrontDesk(request));
    }

    @PostMapping("/patients/{id}/check-in")
    @PreAuthorize("hasAuthority('PERM_checkin:write')")
    public ResponseEntity<PatientDemographicsResponse> checkIn(
            @PathVariable String id,
            @RequestBody(required = false) CheckInPatientRequest request) {
        return ResponseEntity.ok(patientService.checkIn(id, request != null ? request : new CheckInPatientRequest(true, null, null)));
    }

    @PostMapping("/patients/{id}/assign")
    @PreAuthorize("hasAuthority('PERM_patient:assign')")
    public ResponseEntity<PatientAssignmentResponse> assign(
            @PathVariable String id,
            @Valid @RequestBody AssignPatientRequest request) {
        log.info("Front desk assigning patient {} to doctor {}", id, request.doctorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.assignToDoctor(id, request));
    }

    @DeleteMapping("/patients/{id}/assign")
    @PreAuthorize("hasAuthority('PERM_patient:assign')")
    public ResponseEntity<PatientAssignmentResponse> releaseAssignment(@PathVariable String id) {
        return ResponseEntity.ok(patientService.releaseAssignment(id));
    }

    @GetMapping("/patients/{id}/assignments")
    @PreAuthorize("hasAuthority('PERM_patient:assign') or hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<List<PatientAssignmentResponse>> assignmentHistory(@PathVariable String id) {
        return ResponseEntity.ok(patientService.assignmentHistory(id));
    }

    /** Doctors that can take a new patient, optionally filtered by department. */
    @GetMapping("/doctors")
    @PreAuthorize("hasAuthority('PERM_patient:assign')")
    public ResponseEntity<List<DoctorResponse>> availableDoctors(
            @RequestParam(required = false) String departmentId) {
        return ResponseEntity.ok(patientService.availableDoctors(departmentId).stream()
                .map(doctorMapper::toResponse)
                .toList());
    }

    /**
     * Nurses the front desk may allocate a patient to. Name and role only — no
     * contact details or clinical data, which a receptionist has no need for.
     */
    @GetMapping("/nurses")
    @PreAuthorize("hasAuthority('PERM_patient:assign')")
    public ResponseEntity<List<NurseOptionResponse>> availableNurses() {
        return ResponseEntity.ok(patientService.availableNurses().stream()
                .map(nurse -> new NurseOptionResponse(nurse.getId(), nurse.getFullName()))
                .toList());
    }

    /**
     * The caller's own patient panel.
     *
     * <p>The id is always taken from the JWT, never from the query string, so
     * neither a doctor nor a nurse can read another clinician's panel. Which
     * column of the assignment table is consulted depends on the caller's role:
     * `diagnosis:write` reads the doctor column, `vital:write` the nurse column.
     */
    @GetMapping("/patients")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write') or hasAuthority('PERM_vital:write')")
    public ResponseEntity<PageResponse<PatientDemographicsResponse>> myPatients(
            @PageableDefault(size = 20, sort = "assignedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        Page<PatientDemographicsResponse> page = currentUser.is(UserRole.NURSE)
                ? patientService.patientsAssignedToNurse(currentUser.userId(), pageable)
                : patientService.patientsAssignedTo(currentDoctorId(), pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    /**
     * Minimal projection of a nurse for the assignment dropdown.
     */
    public record NurseOptionResponse(String id, String fullName) {
    }

    @GetMapping("/patients/{id}")
    @PreAuthorize("hasAuthority('PERM_patient:demographics:read')")
    public ResponseEntity<PatientDemographicsResponse> demographics(@PathVariable String id) {
        return ResponseEntity.ok(patientService.getDemographics(id));
    }

    private String currentDoctorId() {
        return currentUser.userId();
    }
}