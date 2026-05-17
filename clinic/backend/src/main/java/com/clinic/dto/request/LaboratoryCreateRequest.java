package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LaboratoryCreateRequest(
        @NotBlank(message = "Laboratory name is required")
        String name,

        @NotBlank(message = "Location is required")
        String location,

        String phone,

        String email,

        @NotNull(message = "Status is required")
        String status,

        String operatingHoursStart,

        String operatingHoursEnd,

        String equipment,

        Integer capacity,

        String description
) {
}
