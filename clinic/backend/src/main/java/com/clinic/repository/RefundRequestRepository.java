package com.clinic.repository;

import com.clinic.entity.RefundRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefundRequestRepository extends JpaRepository<RefundRequest, String> {

    Page<RefundRequest> findByStatusOrderByRequestedAtDesc(RefundRequest.Status status, Pageable pageable);

    Page<RefundRequest> findAllByOrderByRequestedAtDesc(Pageable pageable);

    Optional<RefundRequest> findByInvoiceIdAndStatus(String invoiceId, RefundRequest.Status status);

    long countByStatus(RefundRequest.Status status);
}