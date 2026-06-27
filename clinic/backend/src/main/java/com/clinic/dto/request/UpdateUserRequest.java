package com.clinic.dto.request;

import jakarta.validation.constraints.Email;

public record UpdateUserRequest(
        String fullName,
        @Email(message = "Email must be valid") String email,
        String phone,
        Boolean active
) {
}
