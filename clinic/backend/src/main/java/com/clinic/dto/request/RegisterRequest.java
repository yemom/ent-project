package com.clinic.dto.request;

import com.clinic.entity.UserRole;
import com.clinic.validation.PasswordPolicy;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record RegisterRequest(
                @NotBlank(message = "Email is required") @Email(message = "Email must be valid") String email,

                @NotBlank(message = "Password is required")
                @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
                String password,

                @NotBlank(message = "Full name is required") String fullName,

                String phone,

                @NotNull(message = "Role is required") UserRole role) {
}
