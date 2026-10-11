package com.clinic.service;

import com.clinic.dto.request.AssignPatientRequest;
import com.clinic.dto.request.CheckInPatientRequest;
import com.clinic.dto.request.RegisterPatientRequest;
import com.clinic.dto.response.PatientAssignmentResponse;
import com.clinic.dto.response.PatientDemographicsResponse;
import com.clinic.entity.Doctor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface PatientService {

    // ---- existing clinical-shaped API (unchanged behaviour) ----
    com.clinic.dto.response.PatientResponse create(com.clinic.dto.request.PatientCreateRequest request);

    com.clinic.dto.response.PatientResponse update(String id, com.clinic.dto.request.PatientUpdateRequest request);

    com.clinic.dto.response.PatientResponse getById(String id);

    Page<com.clinic.dto.response.PatientResponse> getAll(Pageable pageable);

    Page<com.clinic.dto.response.PatientResponse> search(String fullName, String email, String phone,
                                                          Boolean active, Pageable pageable);

    void delete(String id);

    // ---- front desk ----

    /** Registers a patient from demographics only (no clinical fields). */
    PatientDemographicsResponse registerAtFrontDesk(RegisterPatientRequest request);

    /** Check-in / check-out and queue position. */
    PatientDemographicsResponse checkIn(String patientId, CheckInPatientRequest request);

    /** Assigns a patient to a doctor and notifies that doctor. */
    PatientAssignmentResponse assignToDoctor(String patientId, AssignPatientRequest request);

    /** Releases the active assignment, keeping the history row. */
    PatientAssignmentResponse releaseAssignment(String patientId);

    List<PatientAssignmentResponse> assignmentHistory(String patientId);

    /** Patients currently assigned to the given doctor. */
    Page<PatientDemographicsResponse> patientsAssignedTo(String doctorId, Pageable pageable);

    /**
     * Nurse panel. Same assignment table as the doctor panel, filtered by the
     * nurse column, so a nurse never sees a patient the front desk did not
     * allocate to them.
     */
    Page<PatientDemographicsResponse> patientsAssignedToNurse(String nurseId, Pageable pageable);

    /** Active nurses the front desk may allocate a patient to. */
    List<com.clinic.entity.User> availableNurses();

    /** Doctors available for assignment, optionally filtered by department. */
    List<Doctor> availableDoctors(String departmentId);

    /** Demographics-only read used by front-desk and admin screens. */
    PatientDemographicsResponse getDemographics(String patientId);
}