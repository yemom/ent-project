package com.clinic.repository;

import com.clinic.entity.PrescriptionOrder;
import com.clinic.entity.PrescriptionOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PrescriptionOrderRepository extends JpaRepository<PrescriptionOrder, String>, JpaSpecificationExecutor<PrescriptionOrder> {
    Page<PrescriptionOrder> findByStatus(PrescriptionOrderStatus status, Pageable pageable);

    Page<PrescriptionOrder> findByDoctorId(String doctorId, Pageable pageable);

    long countByStatus(PrescriptionOrderStatus status);

    /** Status breakdown in one round trip, for the pharmacy dashboard. */
    @Query("select p.status, count(p) from PrescriptionOrder p group by p.status")
    List<Object[]> countGroupedByStatus();
}
