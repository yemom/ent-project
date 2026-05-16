package com.clinic.repository;

import com.clinic.entity.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, String>, JpaSpecificationExecutor<Doctor> {

    Optional<Doctor> findByEmail(String email);

    Optional<Doctor> findByLicenseNumber(String licenseNumber);

    boolean existsByEmail(String email);
}
