package com.clinic.dto.request;

import com.clinic.entity.Gender;
import com.clinic.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Creates any account, with the profile fields that role needs.
 *
 * <p>One request record for every role rather than nine: the role-specific block
 * is validated in {@code AdminServiceImpl} once the role is known, which is the
 * only place that can tell whether a missing specialization is an error or simply
 * irrelevant for a cashier. Bean validation still covers the universally required
 * fields so a malformed request fails fast with 400.
 *
 * <p>The password is optional: when omitted the service generates a strong one and
 * returns it exactly once, so no default credential is ever baked into the system.
 */
public record CreateUserRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 100)
        String email,

        @NotBlank(message = "Full name is required")
        @Size(max = 100)
        String fullName,

        @Pattern(regexp = "^$|^[0-9+()\\- ]{7,20}$", message = "Phone must be 7-20 digits")
        String phone,

        @NotNull(message = "Role is required")
        UserRole role,

        @Size(max = 36)
        String branchId,

        @Size(max = 100)
        String department,

        @Size(max = 100)
        String ward,

        /**
         * Optional. When supplied it must satisfy the password policy; when
         * omitted the service generates one and returns it once.
         */
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters")
        String password,

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