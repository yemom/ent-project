package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.InvoiceCreateRequest;
import com.clinic.dto.request.PaymentCreateRequest;
import com.clinic.dto.request.RefundRequestCreateRequest;
import com.clinic.dto.response.InvoiceResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PaymentResponse;
import com.clinic.dto.response.ReceiptResponse;
import com.clinic.dto.response.RefundRequestResponse;
import com.clinic.entity.Invoice;
import com.clinic.entity.RefundRequest;
import com.clinic.service.BillingService;
import com.clinic.service.RefundService;
import com.clinic.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Invoices, payments and receipts.
 *
 * <p>A patient reads their own invoices and receipts; a cashier creates payments
 * and reads every invoice; a doctor cannot reach any of it.
 */
@RestController
@RequestMapping(ApiPaths.BILLING)
@Slf4j
public class BillingController {

    private final BillingService billingService;
    private final RefundService refundService;
    private final AuditLogService auditLogService;

    public BillingController(BillingService billingService,
                            RefundService refundService,
                            AuditLogService auditLogService) {
        this.billingService = billingService;
        this.refundService = refundService;
        this.auditLogService = auditLogService;
    }

    // ---------------- Invoices ----------------

    @GetMapping("/invoices")
    @PreAuthorize("hasAuthority('PERM_invoice:read') or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<PageResponse<InvoiceResponse>> listInvoices(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String patientId,
            @PageableDefault(size = 20, sort = "issuedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        Invoice.Status filter = status == null || status.isBlank()
                ? null
                : Invoice.Status.valueOf(status.toUpperCase());
        return ResponseEntity.ok(billingService.listInvoices(filter, patientId, pageable));
    }

    @GetMapping("/invoices/{id}")
    @PreAuthorize("hasAuthority('PERM_invoice:read') or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<InvoiceResponse> getInvoice(@PathVariable String id) {
        return ResponseEntity.ok(billingService.getInvoice(id));
    }

    @PostMapping("/invoices")
    @PreAuthorize("hasAuthority('PERM_invoice:read')")
    public ResponseEntity<InvoiceResponse> createInvoice(@Valid @RequestBody InvoiceCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(billingService.createInvoice(request));
    }

    // ---------------- Payments ----------------

    @PostMapping("/payments")
    @PreAuthorize("hasAuthority('PERM_payment:create')")
    public ResponseEntity<PaymentResponse> recordPayment(@Valid @RequestBody PaymentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(billingService.recordPayment(request));
    }

    @GetMapping("/payments")
    @PreAuthorize("hasAuthority('PERM_payment:create') or hasAuthority('PERM_invoice:read')")
    public ResponseEntity<PageResponse<PaymentResponse>> listPayments(
            @RequestParam(required = false) String invoiceId,
            @PageableDefault(size = 20, sort = "receivedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(billingService.listPayments(invoiceId, pageable));
    }

    // ---------------- Receipts ----------------

    @GetMapping("/receipts")
    @PreAuthorize("hasAuthority('PERM_receipt:read') or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<PageResponse<ReceiptResponse>> listReceipts(
            @RequestParam(required = false) String invoiceId,
            @PageableDefault(size = 20, sort = "issuedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(billingService.listReceipts(invoiceId, pageable));
    }

    @GetMapping("/receipts/{id}")
    @PreAuthorize("hasAuthority('PERM_receipt:read') or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<ReceiptResponse> getReceipt(@PathVariable String id) {
        return ResponseEntity.ok(billingService.getReceipt(id));
    }

    // ---------------- Reporting ----------------

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('PERM_invoice:read') or hasAuthority('PERM_report:read')")
    public ResponseEntity<Map<String, BigDecimal>> summary(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime start = from != null ? from.atStartOfDay() : null;
        LocalDateTime end = to != null ? to.plusDays(1).atStartOfDay() : null;
        return ResponseEntity.ok(billingService.financialSummary(start, end));
    }

    // ---------------- Refunds ----------------

    @PostMapping("/refunds")
    @PreAuthorize("hasAuthority('PERM_refund:create')")
    public ResponseEntity<RefundRequestResponse> requestRefund(
            @Valid @RequestBody RefundRequestCreateRequest request) {
        RefundRequestResponse response = refundService.requestRefund(
                request.invoiceId(), request.amount(), request.reason());
        auditLogService.record(com.clinic.entity.AuditAction.REFUND_REQUESTED, "INVOICE", request.invoiceId(),
                "Refund of " + request.amount() + " requested: " + request.reason());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/refunds")
    @PreAuthorize("hasAuthority('PERM_refund:create') or hasAuthority('PERM_refund:approve')")
    public ResponseEntity<PageResponse<RefundRequestResponse>> list(
            @RequestParam(required = false) String status,
            @ParameterObject Pageable pageable) {
        RefundRequest.Status filter = status == null || status.isBlank()
                ? null
                : RefundRequest.Status.valueOf(status.toUpperCase());
        return ResponseEntity.ok(refundService.list(filter, pageable));
    }

    @PostMapping("/refunds/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_refund:approve')")
    public ResponseEntity<RefundRequestResponse> approve(@PathVariable String id,
                                                         @RequestParam(required = false) String reason) {
        RefundRequestResponse response = refundService.approve(id, reason);
        auditLogService.record(com.clinic.entity.AuditAction.REFUND_APPROVED, "REFUND_REQUEST", id,
                "Refund approved: " + reason);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refunds/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_refund:approve')")
    public ResponseEntity<RefundRequestResponse> reject(@PathVariable String id,
                                                        @RequestParam(required = false) String reason) {
        RefundRequestResponse response = refundService.reject(id, reason);
        auditLogService.record(com.clinic.entity.AuditAction.REFUND_APPROVED, "REFUND_REQUEST", id,
                "Refund rejected: " + reason);
        return ResponseEntity.ok(response);
    }
}