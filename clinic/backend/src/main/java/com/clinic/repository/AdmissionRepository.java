package com.clinic.repository;

import com.clinic.entity.Admission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdmissionRepository extends JpaRepository<Admission, String> {

    @Override
    @EntityGraph(attributePaths = {"patient", "doctor", "ward", "room"})
    Optional<Admission> findById(String id);

    @EntityGraph(attributePaths = {"patient", "doctor", "ward", "room"})
    Page<Admission> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "ward", "room"})
    Page<Admission> findByStatus(Admission.Status status, Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "ward", "room"})
    Page<Admission> findByPatientId(String patientId, Pageable pageable);

    /** Open admissions for the beds board. */
    @EntityGraph(attributePaths = {"patient", "doctor", "ward", "room"})
    @Query("""
            select a from Admission a
            where a.status = com.clinic.entity.Admission.Status.ADMITTED
            order by a.admittedAt asc
            """)
    List<Admission> findOpenAdmissions();

    @Query("select count(a) from Admission a where a.status = com.clinic.entity.Admission.Status.ADMITTED")
    long countOpen();
}