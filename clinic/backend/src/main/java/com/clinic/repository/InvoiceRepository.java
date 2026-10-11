package com.clinic.repository;

import com.clinic.entity.Invoice;
import com.clinic.entity.InvoiceLine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, String> {

    @Override
    @EntityGraph(attributePaths = {"patient"})
    Page<Invoice> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"patient"})
    Page<Invoice> findByStatus(Invoice.Status status, Pageable pageable);

    @EntityGraph(attributePaths = {"patient"})
    Page<Invoice> findByPatientId(String patientId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"patient", "lines"})
    java.util.Optional<Invoice> findById(String id);

    @EntityGraph(attributePaths = {"patient", "lines"})
    java.util.Optional<Invoice> findWithLinesById(String id);

    boolean existsByInvoiceNumber(String invoiceNumber);

    @Query("select i.status, count(i) from Invoice i group by i.status")
    List<Object[]> countGroupedByStatus();

    @Query("select coalesce(sum(i.total), 0) from Invoice i where i.status <> com.clinic.entity.Invoice.Status.VOID")
    java.math.BigDecimal totalBilled();

    @Query("select coalesce(sum(i.amountPaid), 0) from Invoice i where i.status <> com.clinic.entity.Invoice.Status.VOID")
    java.math.BigDecimal totalCollected();

    @Query("select coalesce(sum(i.total - i.amountPaid), 0) from Invoice i "
            + "where i.status not in (com.clinic.entity.Invoice.Status.VOID, com.clinic.entity.Invoice.Status.PAID)")
    java.math.BigDecimal totalOutstanding();

    @Query("""
            select coalesce(sum(p.amount), 0) from Payment p
            where p.receivedAt between :from and :to and p.status = com.clinic.entity.Payment.Status.COMPLETED
            """)
    java.math.BigDecimal collectedBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}