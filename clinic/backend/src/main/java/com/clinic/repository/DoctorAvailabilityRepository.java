package com.clinic.repository;

import com.clinic.entity.DoctorAvailability;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DoctorAvailabilityRepository extends JpaRepository<DoctorAvailability, String>, JpaSpecificationExecutor<DoctorAvailability> {

    @Override
    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Optional<DoctorAvailability> findById(String id);

    @Override
    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Page<DoctorAvailability> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Page<DoctorAvailability> findByDoctorId(String doctorId, Pageable pageable);

    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Page<DoctorAvailability> findByLaboratoryId(String laboratoryId, Pageable pageable);

    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Page<DoctorAvailability> findByDoctorIdAndLaboratoryId(String doctorId, String laboratoryId, Pageable pageable);

    @EntityGraph(attributePaths = {"doctor", "laboratory"})
    Page<DoctorAvailability> findByDayOfWeek(String dayOfWeek, Pageable pageable);
}
