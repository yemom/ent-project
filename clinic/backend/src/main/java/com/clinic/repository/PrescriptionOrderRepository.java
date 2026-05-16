package com.clinic.repository;

import com.clinic.entity.PrescriptionOrder;
import com.clinic.entity.PrescriptionOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface PrescriptionOrderRepository extends JpaRepository<PrescriptionOrder, String>, JpaSpecificationExecutor<PrescriptionOrder> {
    Page<PrescriptionOrder> findByStatus(PrescriptionOrderStatus status, Pageable pageable);

    Page<PrescriptionOrder> findByDoctorId(String doctorId, Pageable pageable);
}
