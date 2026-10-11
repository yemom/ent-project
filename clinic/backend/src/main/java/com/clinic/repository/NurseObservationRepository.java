package com.clinic.repository;

import com.clinic.entity.NurseObservation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NurseObservationRepository extends JpaRepository<NurseObservation, String> {

    @EntityGraph(attributePaths = "patient")
    Page<NurseObservation> findByPatientId(String patientId, Pageable pageable);

    @EntityGraph(attributePaths = "patient")
    Page<NurseObservation> findByPatientIdAndKind(String patientId, NurseObservation.Kind kind, Pageable pageable);

    /**
     * Observations for an explicit set of patients — used to scope a list to the
     * caller's own panel rather than filtering client-side.
     */
    @EntityGraph(attributePaths = "patient")
    Page<NurseObservation> findByPatientIdIn(List<String> patientIds, Pageable pageable);

    @EntityGraph(attributePaths = "patient")
    Page<NurseObservation> findByPatientIdInAndKind(List<String> patientIds, NurseObservation.Kind kind,
                                                    Pageable pageable);

    @EntityGraph(attributePaths = "patient")
    Page<NurseObservation> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "patient")
    List<NurseObservation> findByPatientIdOrderByObservedAtDesc(String patientId);

    @Query("""
            select o.kind, count(o) from NurseObservation o group by o.kind
            """)
    List<Object[]> countGroupedByKind();

    long countByRecordedById(String recordedById);
}