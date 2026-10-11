package com.clinic.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierUpsertRequest(
        @NotBlank(message = "Supplier name is required")
        @Size(max = 150) String name,

        @Size(max = 120) String contactName,

        @Email(message = "Email must be valid")
        @Size(max = 150) String email,

        @Size(max = 40) String phone,

        @Size(max = 300) String address,

        Boolean active
) {
}