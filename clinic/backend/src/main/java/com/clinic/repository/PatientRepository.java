package com.clinic.repository;

import com.clinic.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, String>, JpaSpecificationExecutor<Patient> {

    Optional<Patient> findByEmail(String email);

    boolean existsByEmail(String email);
}
