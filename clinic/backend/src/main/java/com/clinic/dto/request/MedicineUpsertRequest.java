package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MedicineUpsertRequest(
        @NotBlank(message = "Medicine name is required")
        @Size(max = 150) String name,

        @NotBlank(message = "Medicine code is required")
        @Size(max = 40) String code,

        @Size(max = 60) String category,

        @Size(max = 60) String form,

        @Size(max = 60) String strength,

        @Size(max = 30) String unit,

        @DecimalMin(value = "0.0", message = "Reorder level must not be negative")
        @Digits(integer = 10, fraction = 2) BigDecimal reorderLevel,

        @DecimalMin(value = "0.0", message = "Unit cost must not be negative")
        @Digits(integer = 10, fraction = 2) BigDecimal unitCost,

        Boolean requiresPrescription,

        Boolean active
) {
}