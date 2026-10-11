package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * A stock movement that removes or returns stock.
 *
 * <p>{@code quantity} is always positive. For {@code ADJUSTED}, a leading negative
 * value means "reduce stock" — that is the only kind whose direction is chosen by
 * the caller, because an adjustment is a correction rather than a known flow.
 *
 * <p>The server refuses any movement that would take a batch below zero, so
 * negative stock is impossible rather than merely discouraged.
 */
public record StockMovementRequest(
        @NotNull(message = "Batch is required")
        String batchId,

        @NotBlank(message = "Movement type is required")
        String kind,

        @NotNull(message = "Quantity is required")
        @Digits(integer = 10, fraction = 2) BigDecimal quantity,

        /** Required for DISPENSED so the movement can be tied to its prescription. */
        @Size(max = 36) String prescriptionOrderId,

        @Size(max = 120) String reference,

        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {
}