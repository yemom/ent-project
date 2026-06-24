package com.clinic.repository;

import com.clinic.entity.LabResult;
import com.clinic.entity.LabResultStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LabResultRepository extends JpaRepository<LabResult, String>, JpaSpecificationExecutor<LabResult> {
    @Override
    @EntityGraph(attributePaths = {"labOrder"})
    Optional<LabResult> findById(String id);

    @Override
    @EntityGraph(attributePaths = {"labOrder"})
    Page<LabResult> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"labOrder"})
    Optional<LabResult> findByLabOrderId(String labOrderId);

    @EntityGraph(attributePaths = {"labOrder"})
    Page<LabResult> findByStatus(LabResultStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"labOrder"})
    Page<LabResult> findByLabTechnicianId(String labTechnicianId, Pageable pageable);
}
