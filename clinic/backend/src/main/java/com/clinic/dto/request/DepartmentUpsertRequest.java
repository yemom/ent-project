package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create or update a department. `headDoctorId` is validated server-side against
 * the doctor table, so a stale id in the browser cannot create a dangling head.
 */
public record DepartmentUpsertRequest(
        @NotBlank(message = "Department name is required")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @NotBlank(message = "Department code is required")
        @Size(max = 20, message = "Code must not exceed 20 characters")
        String code,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        String headDoctorId,

        Boolean active
) {
}