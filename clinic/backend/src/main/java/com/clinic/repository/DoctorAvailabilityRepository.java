package com.clinic.repository;

import com.clinic.entity.DoctorAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DoctorAvailabilityRepository extends JpaRepository<DoctorAvailability, String>, JpaSpecificationExecutor<DoctorAvailability> {

    List<DoctorAvailability> findByDoctorId(String doctorId);

    List<DoctorAvailability> findByLaboratoryId(String laboratoryId);

    List<DoctorAvailability> findByDoctorIdAndLaboratoryId(String doctorId, String laboratoryId);

    List<DoctorAvailability> findByDayOfWeek(String dayOfWeek);
}
