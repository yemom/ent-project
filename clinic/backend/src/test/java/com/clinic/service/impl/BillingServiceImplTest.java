package com.clinic.service.impl;

import com.clinic.dto.request.InvoiceCreateRequest;
import com.clinic.dto.request.PaymentCreateRequest;
import com.clinic.dto.response.InvoiceResponse;
import com.clinic.dto.response.PaymentResponse;
import com.clinic.entity.AuditAction;
import com.clinic.entity.Invoice;
import com.clinic.entity.InvoiceLine;
import com.clinic.entity.Patient;
import com.clinic.entity.Payment;
import com.clinic.entity.Receipt;
import com.clinic.exception.BadRequestException;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.PaymentRepository;
import com.clinic.repository.ReceiptRepository;
import com.clinic.security.CurrentUser;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.security.RolePermissions;
import com.clinic.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Billing invariants.
 *
 * <p>These are the money rules, so they are asserted directly rather than through
 * MockMvc: the totals must be derived server-side, overpayment must be refused, and
 * a receipt must exist for every payment.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BillingServiceImplTest {

    private static final String PATIENT_ID = "patient-1";
    private static final String CASHIER_ID = "cashier-1";

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ReceiptRepository receiptRepository;

    @Mock
    private PatientRepository patientRepository;

    @Mock
    private CurrentUser currentUser;

    @Mock
    private com.clinic.service.AuditLogService auditLogService;

    private BillingServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new BillingServiceImpl(invoiceRepository, paymentRepository, receiptRepository,
                patientRepository, currentUser, auditLogService);

        SecurityContextHolder.clearContext();
        // The service records the cashier as the receiver; give it a real principal
        // so that path is exercised rather than stubbed.
        UserRole role = UserRole.CASHIER;
        var user = com.clinic.entity.AdminUser.builder()
                .email("cashier@example.com")
                .fullName("Test Cashier")
                .password("x")
                .role(role)
                .active(true)
                .build();
        user.setId(CASHIER_ID);
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        lenient().when(currentUser.userId()).thenReturn(CASHIER_ID);
        lenient().when(currentUser.is(any())).thenReturn(false);
        lenient().when(currentUser.require()).thenReturn(principal);
        lenient().when(paymentRepository.save(any(Payment.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(receiptRepository.save(any(Receipt.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ---------------- totals ----------------

    @Test
    void computesTotalsFromLinesAndIgnoresAnyClientTotal() {
        when(patientRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient()));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        // 2 x 50 + 1 x 25 = 125 subtotal, 10 tax, 5 discount => 130 total.
        InvoiceCreateRequest request = new InvoiceCreateRequest(
                PATIENT_ID, null, new BigDecimal("5"), new BigDecimal("10"), null, null,
                List.of(
                        new InvoiceCreateRequest.Line("Consultation", "CONSULTATION", 2, new BigDecimal("50")),
                        new InvoiceCreateRequest.Line("Dressing", "NURSING", 1, new BigDecimal("25"))));

        InvoiceResponse response = service.createInvoice(request);

        assertEquals(new BigDecimal("125"), response.subtotal());
        assertEquals(new BigDecimal("130"), response.total());
        assertEquals(new BigDecimal("0"), response.amountPaid());
        assertEquals(new BigDecimal("130"), response.balanceDue());
        assertEquals(2, response.lines().size());
    }

    @Test
    void discountLargerThanSubtotalDoesNotProduceANegativeTotal() {
        when(patientRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient()));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        InvoiceCreateRequest request = new InvoiceCreateRequest(
                PATIENT_ID, null, new BigDecimal("999"), BigDecimal.ZERO, null, null,
                List.of(new InvoiceCreateRequest.Line("Consultation", null, 1, new BigDecimal("50"))));

        InvoiceResponse response = service.createInvoice(request);

        // Clamped at zero: a total below zero would be a payable credit that nobody
        // authorised, and would make every later payment look like an overpayment.
        assertEquals(BigDecimal.ZERO, response.total());
    }

    // ---------------- payments ----------------

    @Test
    void paymentUpdatesTheInvoiceAndIssuesAReceipt() {
        Invoice invoice = invoice(total("100"), paid("0"));
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        PaymentResponse response = service.recordPayment(
                new PaymentCreateRequest("inv-1", new BigDecimal("40"), "CASH", null, null));

        assertEquals(new BigDecimal("40"), invoice.getAmountPaid());
        assertEquals(Invoice.Status.PARTIALLY_PAID, invoice.getStatus());
        assertTrue(response.receiptNumber() != null, "a receipt number must be issued with the payment");

        ArgumentCaptor<Receipt> receipt = ArgumentCaptor.forClass(Receipt.class);
        verify(receiptRepository).save(receipt.capture());
        assertEquals(new BigDecimal("40"), receipt.getValue().getAmount());
        assertEquals(CASHIER_ID, receipt.getValue().getIssuedById());
    }

    @Test
    void fullPaymentMarksTheInvoicePaid() {
        Invoice invoice = invoice(total("100"), paid("0"));
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        service.recordPayment(new PaymentCreateRequest("inv-1", new BigDecimal("100"), "CARD", null, null));

        assertEquals(Invoice.Status.PAID, invoice.getStatus());
        assertEquals(BigDecimal.ZERO, invoice.getBalanceDue());
    }

    @Test
    void overpaymentIsRefused() {
        Invoice invoice = invoice(total("100"), paid("0"));
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        BadRequestException error = assertThrows(BadRequestException.class, () ->
                service.recordPayment(new PaymentCreateRequest("inv-1", new BigDecimal("150"), "CASH", null, null)));

        assertTrue(error.getMessage().contains("exceeds"));
        assertEquals(BigDecimal.ZERO, invoice.getAmountPaid(), "a refused payment must not move the balance");
        verify(paymentRepository, never()).save(any(Payment.class));
        verify(receiptRepository, never()).save(any(Receipt.class));
    }

    @Test
    void paymentOnASettledInvoiceIsRefused() {
        Invoice invoice = invoice(total("100"), paid("100"));
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        assertThrows(BadRequestException.class, () ->
                service.recordPayment(new PaymentCreateRequest("inv-1", new BigDecimal("1"), "CASH", null, null)));
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    void paymentOnAVoidInvoiceIsRefused() {
        Invoice invoice = invoice(total("100"), paid("0"));
        invoice.setStatus(Invoice.Status.VOID);
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        assertThrows(BadRequestException.class, () ->
                service.recordPayment(new PaymentCreateRequest("inv-1", new BigDecimal("10"), "CASH", null, null)));
    }

    @Test
    void anUnknownPaymentMethodIsRejectedWithGuidance() {
        Invoice invoice = invoice(total("100"), paid("0"));
        when(invoiceRepository.findById("inv-1")).thenReturn(Optional.of(invoice));

        BadRequestException error = assertThrows(BadRequestException.class, () ->
                service.recordPayment(new PaymentCreateRequest("inv-1", new BigDecimal("10"), "BITCOIN", null, null)));

        assertTrue(error.getMessage().contains("CASH"), "the error should list the accepted methods");
    }

    // ---------------- helpers ----------------

    private Patient patient() {
        Patient patient = Patient.builder()
                .email("patient@example.com")
                .fullName("Test Patient")
                .password("x")
                .role(UserRole.PATIENT)
                .active(true)
                .build();
        patient.setId(PATIENT_ID);
        return patient;
    }

    private Invoice invoice(BigDecimal total, BigDecimal paid) {
        Invoice invoice = Invoice.builder()
                .invoiceNumber("INV-1")
                .patient(patient())
                .status(Invoice.Status.ISSUED)
                .subtotal(total)
                .discount(BigDecimal.ZERO)
                .tax(BigDecimal.ZERO)
                .total(total)
                .amountPaid(paid)
                .issuedAt(java.time.LocalDateTime.now())
                .build();
        invoice.setId("inv-1");
        invoice.addLine(InvoiceLine.builder()
                .description("Consultation")
                .quantity(1)
                .unitPrice(total)
                .build());
        return invoice;
    }

    private BigDecimal total(String value) {
        return new BigDecimal(value);
    }

    private BigDecimal paid(String value) {
        return new BigDecimal(value);
    }

    /** Keeps the unused-import checker honest about the permission vocabulary. */
    @Test
    void cashierHoldsPaymentAndReceiptPermissions() {
        Set<String> granted = RolePermissions.forRole(UserRole.CASHIER);
        assertTrue(granted.contains("payment:create"));
        assertTrue(granted.contains("receipt:read"));
    }
}