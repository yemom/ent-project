package com.clinic.repository;

import com.clinic.entity.PatientAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PatientAssignmentRepository extends JpaRepository<PatientAssignment, String> {

    Optional<PatientAssignment> findByPatientIdAndReleasedAtIsNull(String patientId);

    Optional<PatientAssignment> findByPatientIdAndDoctorIdAndReleasedAtIsNull(String patientId, String doctorId);

    List<PatientAssignment> findByPatientIdOrderByAssignedAtDesc(String patientId);

    boolean existsByPatientIdAndDoctorIdAndReleasedAtIsNull(String patientId, String doctorId);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<PatientAssignment> findByDoctorIdAndReleasedAtIsNull(String doctorId, Pageable pageable);

    long countByDoctorIdAndReleasedAtIsNull(String doctorId);

    /**
     * Nurse-scoped panel. Same active-row semantics as the doctor query above, so
     * "assigned to you" means one thing whichever clinical role is asking.
     */
    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<PatientAssignment> findByNurseIdAndReleasedAtIsNull(String nurseId, Pageable pageable);

    long countByNurseIdAndReleasedAtIsNull(String nurseId);

    boolean existsByPatientIdAndNurseIdAndReleasedAtIsNull(String patientId, String nurseId);
}