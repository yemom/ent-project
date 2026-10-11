package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Records that a patient was admitted to a ward/room.
 * Only doctors hold `admission:write`, so the API rejects other roles.
 */
public record AdmissionCreateRequest(
        @NotBlank(message = "Patient is required")
        String patientId,

        String doctorId,
        String wardId,
        String roomId,

        @Size(max = 500, message = "Diagnosis must not exceed 500 characters")
        String diagnosis,

        @Size(max = 2000, message = "Notes must not exceed 2000 characters")
        String notes
) {
}