package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Amends an existing medical record.
 *
 * <p>A reason is mandatory: signed records are immutable, so an edit is recorded
 * as an amendment row holding the previous values rather than a silent update.
 */
public record MedicalRecordAmendRequest(
        @NotBlank(message = "A reason for the amendment is required")
        @Size(min = 10, max = 500, message = "Reason must be between 10 and 500 characters")
        String reason,

        String diagnosis,
        String treatment,
        String prescription,
        String testResults,
        String vitalSigns,
        String notes,
        Boolean followUpRequired,
        LocalDate followUpDate,
        String medicalRecordType,
        Boolean confidential
) {
}