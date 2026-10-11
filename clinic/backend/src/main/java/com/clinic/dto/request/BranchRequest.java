package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;

public record BranchRequest(
        @NotBlank(message = "Branch name is required")
        String name,

        @NotBlank(message = "Branch code is required")
        String code,

        String address,

        String phone,

        String email,

        String type,

        Boolean active,

        String notes
) {
}
