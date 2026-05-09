package com.clinic.repository;

import com.clinic.entity.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.UUID;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, UUID>, JpaSpecificationExecutor<MedicalRecord> {

    Page<MedicalRecord> findByPatientId(UUID patientId, Pageable pageable);

    Page<MedicalRecord> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<MedicalRecord> findByAppointmentId(UUID appointmentId, Pageable pageable);

    Page<MedicalRecord> findByRecordDateBetween(LocalDate from, LocalDate to, Pageable pageable);
}
