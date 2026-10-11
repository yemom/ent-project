package com.clinic.dto.response;

import com.clinic.entity.Invoice;
import com.clinic.entity.InvoiceLine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record InvoiceResponse(
        String id,
        String invoiceNumber,
        String patientId,
        String patientName,
        String appointmentId,
        String status,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal tax,
        BigDecimal total,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        String notes,
        LocalDateTime issuedAt,
        LocalDateTime dueAt,
        List<Line> lines
) {
    public record Line(
            String id,
            String description,
            String category,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal amount
    ) {
        public static Line from(InvoiceLine line) {
            return new Line(
                    line.getId(),
                    line.getDescription(),
                    line.getCategory(),
                    line.getQuantity(),
                    line.getUnitPrice(),
                    line.getAmount()
            );
        }
    }

    public static InvoiceResponse from(Invoice invoice, boolean includeLines) {
        List<Line> lines = includeLines
                ? invoice.getLines().stream().map(Line::from).toList()
                : List.of();

        return new InvoiceResponse(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                invoice.getPatient() != null ? invoice.getPatient().getId() : null,
                invoice.getPatient() != null ? invoice.getPatient().getFullName() : null,
                invoice.getAppointmentId(),
                invoice.getStatus() != null ? invoice.getStatus().name() : null,
                invoice.getSubtotal(),
                invoice.getDiscount(),
                invoice.getTax(),
                invoice.getTotal(),
                invoice.getAmountPaid(),
                invoice.getBalanceDue(),
                invoice.getNotes(),
                invoice.getIssuedAt(),
                invoice.getDueAt(),
                lines
        );
    }
}