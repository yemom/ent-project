package com.clinic.dto.request;

import com.clinic.validation.PasswordPolicy;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record DoctorCreateRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String email,

        @NotBlank(message = "Password is required")
        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
        String password,

        @NotBlank(message = "Full name is required")
        String fullName,

        String phone,

        @NotBlank(message = "Specialization is required")
        String specialization,

        @NotBlank(message = "License number is required")
        String licenseNumber,

        @Positive(message = "Years of experience must be positive")
        Integer yearsOfExperience,

        String qualifications,
        BigDecimal consultationFee,
        String bio
) {
}
