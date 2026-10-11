package com.clinic.dto.request;

import com.clinic.entity.Gender;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Edits an account's profile.
 *
 * <p>Every field is optional: only what is sent is changed. Role is deliberately
 * absent — it moves through the dedicated, dual-approved role-change endpoint so a
 * profile edit can never escalate an account by accident.
 *
 * <p>A blank value clears the field rather than being ignored, so an administrator
 * can actually correct a bad address.
 */
public record UpdateUserRequest(
        @Email(message = "Email must be valid")
        @Size(max = 100)
        String email,

        @Size(max = 100, message = "Full name must not exceed 100 characters")
        String fullName,

        @Pattern(regexp = "^$|^[0-9+()\\- ]{7,20}$", message = "Phone must be 7-20 digits")
        String phone,

        @Size(max = 36)
        String branchId,

        @Size(max = 100)
        String department,

        @Size(max = 100)
        String ward,

        // ---- Doctor ----
        @Size(max = 100) String specialization,
        @Size(max = 50) String licenseNumber,
        @Positive(message = "Years of experience cannot be negative") Integer yearsOfExperience,
        String qualifications,
        @jakarta.validation.constraints.DecimalMin(value = "0.0", message = "Consultation fee cannot be negative")
        BigDecimal consultationFee,
        @Size(max = 4000) String bio,
        Boolean available,

        // ---- Pharmacist ----
        @Size(max = 50) String employeeNumber,
        @Size(max = 100) String pharmacyLocation,

        // ---- Patient ----
        LocalDate dateOfBirth,
        Gender gender,
        @Size(max = 300) String address,
        @Size(max = 5) String bloodType,
        String medicalHistory,
        String allergies,
        @Size(max = 100) String emergencyContactName,
        @Size(max = 20) String emergencyContactPhone,
        @Size(max = 30) String registrationNumber
) {
}