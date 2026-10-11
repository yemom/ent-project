package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Creates an invoice with its lines.
 *
 * <p>The client sends line items only. Totals are recomputed on the server so a
 * tampered `total` field cannot be stored.
 */
public record InvoiceCreateRequest(
        @NotNull(message = "Patient is required")
        String patientId,

        String appointmentId,

        @DecimalMin(value = "0.0", message = "Discount must not be negative")
        @Digits(integer = 10, fraction = 2)
        BigDecimal discount,

        @DecimalMin(value = "0.0", message = "Tax must not be negative")
        @Digits(integer = 10, fraction = 2)
        BigDecimal tax,

        LocalDateTime dueAt,

        @Size(max = 500, message = "Notes must not exceed 500 characters")
        String notes,

        @NotNull(message = "At least one line item is required")
        @Size(min = 1, message = "At least one line item is required")
        List<Line> lines
) {
    public record Line(
            @NotNull(message = "Description is required")
            @Size(max = 200) String description,

            @Size(max = 40) String category,

            @jakarta.validation.constraints.Positive(message = "Quantity must be positive")
            Integer quantity,

            @NotNull(message = "Unit price is required")
            @DecimalMin(value = "0.0", message = "Unit price must not be negative")
            @Digits(integer = 10, fraction = 2)
            BigDecimal unitPrice
    ) {
    }
}