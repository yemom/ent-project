package com.clinic.dto.request;

import com.clinic.entity.Gender;
import com.clinic.validation.PasswordPolicy;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;

public record PatientCreateRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String email,

        @NotBlank(message = "Password is required")
        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
        String password,

        @NotBlank(message = "Full name is required")
        String fullName,

        String phone,

        LocalDate dateOfBirth,
        Gender gender,
        String medicalHistory,
        String bloodType,
        String allergies,
        String emergencyContactName,
        String emergencyContactPhone
) {
}
