package com.clinic.repository;

import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, String>, JpaSpecificationExecutor<Appointment> {

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor"})
    Optional<Appointment> findById(String id);

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findAll(Specification<Appointment> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByPatientId(String patientId, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByDoctorId(String doctorId, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByStatus(AppointmentStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByAppointmentDateBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);

    long countByAppointmentDateBetween(LocalDateTime from, LocalDateTime to);

    /** Status breakdown in one round trip, for the admin dashboard. */
    @Query("select a.status, count(a) from Appointment a group by a.status")
    List<Object[]> countGroupedByStatus();

    /**
     * Daily appointment volume since a cutoff, grouped in the database.
     * Keeps the trend chart to one query instead of loading every row.
     *
     * <p>The alias is {@code trend_day} rather than {@code day} because {@code DAY}
     * is a keyword in H2, so the shorter alias parses on PostgreSQL but fails on
     * any H2-backed environment (tests, local dev) with a syntax error.
     */
    @Query(value = """
            SELECT CAST(appointment_date AS DATE) AS trend_day, COUNT(*) AS total
            FROM appointments
            WHERE deleted = false AND appointment_date >= :from
            GROUP BY CAST(appointment_date AS DATE)
            ORDER BY trend_day
            """, nativeQuery = true)
    List<Object[]> dailyVolumeSince(@org.springframework.data.repository.query.Param("from")
                                    LocalDateTime from);

    /** Next appointments for a doctor, ordered by time — the doctor's own panel. */
    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByDoctorIdAndAppointmentDateAfterOrderByAppointmentDateAsc(
            String doctorId, LocalDateTime after, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor"})
    Page<Appointment> findByPatientIdAndAppointmentDateAfterOrderByAppointmentDateAsc(
            String patientId, LocalDateTime after, Pageable pageable);
}
