package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record WardUpsertRequest(
        @NotNull(message = "Department is required")
        String departmentId,

        @NotBlank(message = "Ward name is required")
        @Size(max = 100) String name,

        @NotBlank(message = "Ward code is required")
        @Size(max = 20) String code,

        @Size(max = 20) String floor,

        @Positive(message = "Capacity must be positive")
        Integer capacity,

        Boolean active
) {
}