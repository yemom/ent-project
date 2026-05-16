package com.clinic.repository;

import com.clinic.entity.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, String>, JpaSpecificationExecutor<MedicalRecord> {

    Page<MedicalRecord> findByPatientId(String patientId, Pageable pageable);

    Page<MedicalRecord> findByDoctorId(String doctorId, Pageable pageable);

    Page<MedicalRecord> findByAppointmentId(String appointmentId, Pageable pageable);

    Page<MedicalRecord> findByRecordDateBetween(LocalDate from, LocalDate to, Pageable pageable);
}
