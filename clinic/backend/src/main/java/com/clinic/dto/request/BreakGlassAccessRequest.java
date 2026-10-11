package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Reason capture for emergency "break-glass" access to a patient record.
 * Mandatory: a blank reason is rejected by bean validation.
 */
public record BreakGlassAccessRequest(
        @NotBlank(message = "A reason is required for break-glass access")
        @Size(min = 10, max = 500, message = "Reason must be between 10 and 500 characters")
        String reason
) {
}