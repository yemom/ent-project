package com.clinic.repository;

import com.clinic.entity.Receipt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, String> {

    @EntityGraph(attributePaths = {"invoice", "invoice.patient", "payment"})
    Page<Receipt> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"invoice", "invoice.patient", "payment"})
    Page<Receipt> findByInvoiceId(String invoiceId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"invoice", "invoice.patient", "payment"})
    Optional<Receipt> findById(String id);

    @EntityGraph(attributePaths = {"invoice", "invoice.patient", "payment"})
    Optional<Receipt> findByPaymentId(String paymentId);

    boolean existsByReceiptNumber(String receiptNumber);
}