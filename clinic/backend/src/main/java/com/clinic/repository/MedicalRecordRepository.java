package com.clinic.repository;

import com.clinic.entity.MedicalRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, String>, JpaSpecificationExecutor<MedicalRecord> {

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Optional<MedicalRecord> findById(String id);

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findAll(Specification<MedicalRecord> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findByPatientId(String patientId, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findByDoctorId(String doctorId, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findByAppointmentId(String appointmentId, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "appointment"})
    Page<MedicalRecord> findByRecordDateBetween(LocalDate from, LocalDate to, Pageable pageable);
}
