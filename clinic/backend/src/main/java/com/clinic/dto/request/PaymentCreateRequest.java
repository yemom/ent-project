package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PaymentCreateRequest(
        @NotNull(message = "Invoice is required")
        String invoiceId,

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        @Digits(integer = 10, fraction = 2, message = "Amount must have at most 2 decimal places")
        BigDecimal amount,

        @NotBlank(message = "Payment method is required")
        String method,

        /** Optional external reference (card auth code, mobile money id, …). */
        @Size(max = 100)
        String reference,

        @Size(max = 500, message = "Notes must not exceed 500 characters")
        String notes
) {
}