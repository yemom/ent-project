package com.clinic.repository;

import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, String>, JpaSpecificationExecutor<Appointment> {

    Page<Appointment> findByPatientId(String patientId, Pageable pageable);

    Page<Appointment> findByDoctorId(String doctorId, Pageable pageable);

    Page<Appointment> findByStatus(AppointmentStatus status, Pageable pageable);

    Page<Appointment> findByAppointmentDateBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);
}
