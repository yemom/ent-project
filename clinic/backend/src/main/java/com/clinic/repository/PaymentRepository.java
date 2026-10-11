package com.clinic.repository;

import com.clinic.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {

    @Override
    @EntityGraph(attributePaths = {"invoice", "invoice.patient"})
    Page<Payment> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"invoice", "invoice.patient"})
    Page<Payment> findByInvoiceId(String invoiceId, Pageable pageable);

    boolean existsByPaymentRef(String paymentRef);
}