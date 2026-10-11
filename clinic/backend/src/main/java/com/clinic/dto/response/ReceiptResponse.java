package com.clinic.dto.response;

import com.clinic.entity.Receipt;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ReceiptResponse(
        String id,
        String receiptNumber,
        String paymentId,
        String invoiceId,
        String invoiceNumber,
        String patientName,
        BigDecimal amount,
        String issuedById,
        LocalDateTime issuedAt
) {
    public static ReceiptResponse from(Receipt receipt) {
        return new ReceiptResponse(
                receipt.getId(),
                receipt.getReceiptNumber(),
                receipt.getPayment() != null ? receipt.getPayment().getId() : null,
                receipt.getInvoice() != null ? receipt.getInvoice().getId() : null,
                receipt.getInvoice() != null ? receipt.getInvoice().getInvoiceNumber() : null,
                receipt.getInvoice() != null && receipt.getInvoice().getPatient() != null
                        ? receipt.getInvoice().getPatient().getFullName() : null,
                receipt.getAmount(),
                receipt.getIssuedById(),
                receipt.getIssuedAt()
        );
    }
}