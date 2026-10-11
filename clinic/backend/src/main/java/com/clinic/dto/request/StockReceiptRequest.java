package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Receives a batch of stock.
 *
 * <p>Creates the batch if the (medicine, batch number) pair is new, otherwise tops
 * up the existing one. {@code unitCost} is captured on the batch so historical cost
 * survives a later catalogue price change.
 */
public record StockReceiptRequest(
        @NotNull(message = "Medicine is required")
        String medicineId,

        String supplierId,

        @NotBlank(message = "Batch number is required")
        @Size(max = 60) String batchNumber,

        @NotNull(message = "Expiry date is required")
        LocalDate expiryDate,

        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
        @Digits(integer = 10, fraction = 2) BigDecimal quantity,

        @DecimalMin(value = "0.0", message = "Unit cost must not be negative")
        @Digits(integer = 10, fraction = 2) BigDecimal unitCost,

        /** Reference such as a delivery note number. */
        @Size(max = 120) String reference,

        @Size(max = 500, message = "Notes must not exceed 500 characters")
        String notes
) {
}