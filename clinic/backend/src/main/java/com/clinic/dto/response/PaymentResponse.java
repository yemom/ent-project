package com.clinic.dto.response;

import com.clinic.entity.Payment;
import com.clinic.entity.Receipt;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        String id,
        String paymentRef,
        String invoiceId,
        String invoiceNumber,
        String patientName,
        BigDecimal amount,
        String method,
        String status,
        String receivedById,
        String notes,
        LocalDateTime receivedAt,
        String receiptId,
        String receiptNumber
) {
    public static PaymentResponse from(Payment payment, Receipt receipt) {
        return new PaymentResponse(
                payment.getId(),
                payment.getPaymentRef(),
                payment.getInvoice() != null ? payment.getInvoice().getId() : null,
                payment.getInvoice() != null ? payment.getInvoice().getInvoiceNumber() : null,
                payment.getInvoice() != null && payment.getInvoice().getPatient() != null
                        ? payment.getInvoice().getPatient().getFullName() : null,
                payment.getAmount(),
                payment.getMethod() != null ? payment.getMethod().name() : null,
                payment.getStatus() != null ? payment.getStatus().name() : null,
                payment.getReceivedById(),
                payment.getNotes(),
                payment.getReceivedAt(),
                receipt != null ? receipt.getId() : null,
                receipt != null ? receipt.getReceiptNumber() : null
        );
    }
}