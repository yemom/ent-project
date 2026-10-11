package com.clinic.repository;

import com.clinic.entity.Doctor;
import com.clinic.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, String>, JpaSpecificationExecutor<Doctor> {

    Optional<Doctor> findByEmail(String email);

    Optional<Doctor> findByLicenseNumber(String licenseNumber);

    boolean existsByEmail(String email);

    /** Active, currently-accepting doctors; used by the front-desk assign picker. */
    List<Doctor> findAllByRoleInAndActiveTrueAndAvailableTrue(Collection<UserRole> roles);

    /**
     * Every doctor regardless of roster status.
     *
     * <p>Used by global search, which must find an off-duty or inactive doctor too —
     * an administrator looking someone up does not care whether they are on shift
     * today. Deliberately not filtered on {@code available}, which would hide real
     * people from the directory.
     */
    List<Doctor> findAllByRoleIn(Collection<UserRole> roles);
}
