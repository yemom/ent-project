package com.clinic.repository;

import com.clinic.entity.LabOrder;
import com.clinic.entity.LabOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LabOrderRepository extends JpaRepository<LabOrder, String>, JpaSpecificationExecutor<LabOrder> {
    Page<LabOrder> findByStatus(LabOrderStatus status, Pageable pageable);

    Page<LabOrder> findByDoctorId(String doctorId, Pageable pageable);

    Page<LabOrder> findByPatientId(String patientId, Pageable pageable);

    List<LabOrder> findByStatusAndPatientId(LabOrderStatus status, String patientId);

    Page<LabOrder> findByUrgency(String urgency, Pageable pageable);

    long countByStatus(LabOrderStatus status);

    /** Status breakdown in one round trip, for the lab dashboard. */
    @Query("select o.status, count(o) from LabOrder o group by o.status")
    List<Object[]> countGroupedByStatus();
}
