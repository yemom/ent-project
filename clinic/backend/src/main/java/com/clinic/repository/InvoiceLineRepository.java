package com.clinic.repository;

import com.clinic.entity.InvoiceLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvoiceLineRepository extends JpaRepository<InvoiceLine, String> {

    List<InvoiceLine> findByInvoiceId(String invoiceId);

    void deleteByInvoiceId(String invoiceId);
}