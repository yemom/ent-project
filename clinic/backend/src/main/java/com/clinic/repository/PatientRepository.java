package com.clinic.repository;

import com.clinic.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, String>, JpaSpecificationExecutor<Patient> {

    Optional<Patient> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Patients registered inside a window.
     *
     * <p>Counts, not rows: a registration <em>trend</em> does not need to know
     * who registered, and a count is the smallest thing that answers the question
     * a hospital administrator actually asks.
     */
    @Query("SELECT COUNT(p) FROM Patient p "
            + "WHERE p.createdAt >= :from AND p.createdAt < :to AND p.deleted = false")
    long countCreatedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
