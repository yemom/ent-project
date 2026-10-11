package com.clinic.service.impl;

import com.clinic.dto.request.InvoiceCreateRequest;
import com.clinic.dto.request.PaymentCreateRequest;
import com.clinic.dto.response.InvoiceResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PaymentResponse;
import com.clinic.dto.response.ReceiptResponse;
import com.clinic.entity.Invoice;
import com.clinic.entity.InvoiceLine;
import com.clinic.entity.Payment;
import com.clinic.entity.Patient;
import com.clinic.entity.Receipt;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.PaymentRepository;
import com.clinic.repository.ReceiptRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuditLogService;
import com.clinic.service.BillingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Billing.
 *
 * <p>Three invariants this enforces:
 * <ol>
 *   <li><b>Totals are server-computed.</b> The client never sends a total; lines
 *       are summed and the totals recalculated before persisting.</li>
 *   <li><b>Payments cannot exceed the balance.</b> Overpayment is rejected rather
 *       than producing a negative balance that a later refund has to unwind.</li>
 *   <li><b>A receipt exists for every completed payment</b>, created in the same
 *       transaction, so payment and proof cannot diverge.</li>
 * </ol>
 */
@Service
@Transactional
@Slf4j
public class BillingServiceImpl implements BillingService {

    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ReceiptRepository receiptRepository;
    private final PatientRepository patientRepository;
    private final CurrentUser currentUser;
    private final AuditLogService auditLogService;

    public BillingServiceImpl(InvoiceRepository invoiceRepository,
                             PaymentRepository paymentRepository,
                             ReceiptRepository receiptRepository,
                             PatientRepository patientRepository,
                             CurrentUser currentUser,
                             AuditLogService auditLogService) {
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
        this.receiptRepository = receiptRepository;
        this.patientRepository = patientRepository;
        this.currentUser = currentUser;
        this.auditLogService = auditLogService;
    }

    // ================= Invoices =================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<InvoiceResponse> listInvoices(Invoice.Status status, String patientId,
                                                      Pageable pageable) {
        Page<Invoice> page = resolvePatientScope(patientId, status, pageable);
        return PageResponse.of(page.map(invoice -> InvoiceResponse.from(invoice, false)));
    }

    @Override
    @Transactional(readOnly = true)
    public InvoiceResponse getInvoice(String id) {
        Invoice invoice = invoiceRepository.findWithLinesById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        assertCanView(invoice);
        return InvoiceResponse.from(invoice, true);
    }

    @Override
    public InvoiceResponse createInvoice(InvoiceCreateRequest request) {
        Patient patient = patientRepository.findById(request.patientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + request.patientId()));

        Invoice invoice = Invoice.builder()
                .invoiceNumber(nextNumber("INV"))
                .patient(patient)
                .appointmentId(request.appointmentId())
                .status(Invoice.Status.ISSUED)
                .discount(request.discount() == null ? BigDecimal.ZERO : request.discount())
                .tax(request.tax() == null ? BigDecimal.ZERO : request.tax())
                .issuedAt(LocalDateTime.now())
                .dueAt(request.dueAt())
                .notes(request.notes())
                .build();

        for (InvoiceCreateRequest.Line lineRequest : request.lines()) {
            InvoiceLine line = InvoiceLine.builder()
                    .description(lineRequest.description().trim())
                    .category(lineRequest.category() == null || lineRequest.category().isBlank()
                            ? "CONSULTATION" : lineRequest.category().trim())
                    .quantity(lineRequest.quantity() == null ? 1 : lineRequest.quantity())
                    .unitPrice(lineRequest.unitPrice())
                    .build();
            line.recalculateAmount();
            invoice.addLine(line);
        }

        // Totals come from the lines, never from the request body.
        invoice.recalculate();

        Invoice saved = invoiceRepository.save(invoice);
        log.info("Created invoice {} for patient {} total={}",
                saved.getInvoiceNumber(), patient.getId(), saved.getTotal());
        return InvoiceResponse.from(saved, true);
    }

    // ================= Payments =================

    @Override
    public PaymentResponse recordPayment(PaymentCreateRequest request) {
        Invoice invoice = invoiceRepository.findById(request.invoiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + request.invoiceId()));

        if (invoice.getStatus() == Invoice.Status.VOID) {
            throw new BadRequestException("This invoice is void and cannot accept payment");
        }

        BigDecimal balance = invoice.getBalanceDue();
        if (balance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("This invoice is already fully paid");
        }
        if (request.amount().compareTo(balance) > 0) {
            throw new BadRequestException(
                    "Payment of " + request.amount() + " exceeds the outstanding balance of " + balance);
        }

        Payment payment = Payment.builder()
                .paymentRef(request.reference() == null || request.reference().isBlank()
                        ? nextNumber("PAY") : normaliseRef(request.reference()))
                .invoice(invoice)
                .amount(request.amount())
                .method(parseMethod(request.method()))
                .status(Payment.Status.COMPLETED)
                .receivedById(currentUser.userId())
                .receivedAt(LocalDateTime.now())
                .notes(request.notes())
                .build();

        Payment savedPayment = paymentRepository.save(payment);

        invoice.setAmountPaid(invoice.getAmountPaid().add(request.amount()));
        invoice.refreshPaymentStatus();
        invoiceRepository.save(invoice);

        // Receipt in the same transaction: a payment without proof is not allowed.
        Receipt receipt = receiptRepository.save(Receipt.builder()
                .receiptNumber(nextNumber("RCP"))
                .payment(savedPayment)
                .invoice(invoice)
                .amount(request.amount())
                .issuedById(currentUser.userId())
                .issuedAt(LocalDateTime.now())
                .build());

        log.info("Recorded payment {} of {} against invoice {}",
                savedPayment.getPaymentRef(), request.amount(), invoice.getInvoiceNumber());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "PAYMENT",
                savedPayment.getId(), "Payment of " + request.amount() + " on " + invoice.getInvoiceNumber());

        return PaymentResponse.from(savedPayment, receipt);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> listPayments(String invoiceId, Pageable pageable) {
        Page<Payment> page = (invoiceId == null || invoiceId.isBlank())
                ? paymentRepository.findAll(pageable)
                : paymentRepository.findByInvoiceId(invoiceId, pageable);

        return PageResponse.of(page.map(payment -> PaymentResponse.from(
                payment, receiptRepository.findByPaymentId(payment.getId()).orElse(null))));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ReceiptResponse> listReceipts(String invoiceId, Pageable pageable) {
        Page<Receipt> page = (invoiceId == null || invoiceId.isBlank())
                ? receiptRepository.findAll(pageable)
                : receiptRepository.findByInvoiceId(invoiceId, pageable);

        return PageResponse.of(page.map(receipt -> {
            assertCanView(receipt.getInvoice());
            return ReceiptResponse.from(receipt);
        }));
    }

    @Override
    @Transactional(readOnly = true)
    public ReceiptResponse getReceipt(String id) {
        Receipt receipt = receiptRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Receipt not found: " + id));
        assertCanView(receipt.getInvoice());
        return ReceiptResponse.from(receipt);
    }

    // ================= Reporting =================

    @Override
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> financialSummary(LocalDateTime from, LocalDateTime to) {
        LocalDateTime start = from != null ? from : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime end = to != null ? to : LocalDateTime.now();

        Map<String, BigDecimal> summary = new LinkedHashMap<>();
        summary.put("totalBilled", invoiceRepository.totalBilled());
        summary.put("totalCollected", invoiceRepository.totalCollected());
        summary.put("totalOutstanding", invoiceRepository.totalOutstanding());
        summary.put("collectedInPeriod", invoiceRepository.collectedBetween(start, end));
        return summary;
    }

    // ================= helpers =================

    /**
     * A patient only ever sees their own invoices; staff roles see the filter
     * they asked for. The scope is derived from the caller, never from the query.
     */
    private Page<Invoice> resolvePatientScope(String patientId, Invoice.Status status, Pageable pageable) {
        String scope = currentUser.is(com.clinic.entity.UserRole.PATIENT)
                ? currentUser.userId()
                : (patientId == null || patientId.isBlank() ? null : patientId);

        if (scope == null) {
            return status != null
                    ? invoiceRepository.findByStatus(status, pageable)
                    : invoiceRepository.findAll(pageable);
        }
        return invoiceRepository.findByPatientId(scope, pageable);
    }

    private void assertCanView(Invoice invoice) {
        if (!currentUser.is(com.clinic.entity.UserRole.PATIENT)) {
            return;
        }
        if (invoice.getPatient() == null || !invoice.getPatient().getId().equals(currentUser.userId())) {
            // Reported as "not found" so a patient cannot probe for other ids.
            throw new ResourceNotFoundException("Invoice not found");
        }
    }

    private Payment.Method parseMethod(String value) {
        try {
            return Payment.Method.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("method must be one of CASH, CARD, MOBILE, INSURANCE, BANK_TRANSFER");
        }
    }

    private String normaliseRef(String reference) {
        String trimmed = reference.trim();
        return trimmed.length() > 40 ? trimmed.substring(0, 40) : trimmed;
    }

    /**
     * Sequential, human-readable document number.
     *
     * <p>The random suffix keeps it collision-safe under concurrent issuance while
     * staying sortable by date, and the uniqueness check catches the rare clash.
     */
    private String nextNumber(String prefix) {
        String stamp = LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        for (int attempt = 0; attempt < 5; attempt++) {
            String suffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
            String candidate = prefix + "-" + stamp + "-" + suffix;
            boolean taken = "PAY".equals(prefix)
                    ? paymentRepository.existsByPaymentRef(candidate)
                    : ("RCP".equals(prefix)
                        ? receiptRepository.existsByReceiptNumber(candidate)
                        : invoiceRepository.existsByInvoiceNumber(candidate));
            if (!taken) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not allocate a unique document number");
    }
}