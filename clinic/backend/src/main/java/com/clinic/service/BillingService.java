package com.clinic.service;

import com.clinic.dto.request.InvoiceCreateRequest;
import com.clinic.dto.request.PaymentCreateRequest;
import com.clinic.dto.response.InvoiceResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PaymentResponse;
import com.clinic.dto.response.ReceiptResponse;
import com.clinic.entity.Invoice;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Invoicing, payments and receipts.
 *
 * <p>A cashiers holds {@code payment:create} but not {@code invoice:read} for
 * other patients; every read is scoped to the caller's patient rows unless the
 * caller also holds a broader billing permission.
 */
public interface BillingService {

    PageResponse<InvoiceResponse> listInvoices(Invoice.Status status, String patientId, Pageable pageable);

    InvoiceResponse getInvoice(String id);

    InvoiceResponse createInvoice(InvoiceCreateRequest request);

    PaymentResponse recordPayment(PaymentCreateRequest request);

    PageResponse<PaymentResponse> listPayments(String invoiceId, Pageable pageable);

    PageResponse<ReceiptResponse> listReceipts(String invoiceId, Pageable pageable);

    ReceiptResponse getReceipt(String id);

    /** Revenue summary used by the cashier and admin dashboards. */
    Map<String, BigDecimal> financialSummary(LocalDateTime from, LocalDateTime to);
}