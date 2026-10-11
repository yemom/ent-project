package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Front-desk patient registration. Demographics only — clinical fields are
 * deliberately absent so the receptionist cannot enter diagnoses or notes.
 */
public record RegisterPatientRequest(
        @NotBlank(message = "Full name is required")
        String fullName,

        @NotBlank(message = "Email is required")
        String email,

        /**
         * Optional: when the patient already has an account this reuses it.
         * Otherwise a placeholder password is generated and reset is required.
         */
        String password,

        String phone,
        String dateOfBirth,
        String gender,
        String bloodType,
        String emergencyContactName,
        String emergencyContactPhone,
        String branchId,
        String registrationNumber
) {
}