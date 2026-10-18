package com.clinic.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A request to start a password reset.
 *
 * <p>Deliberately carries no client identifier, no patient id and no role: the
 * workflow resolves the account from the address alone, so there is nothing in the
 * request for a caller to tamper with in order to reach another account.
 *
 * <p>{@code @Size} bounds the input before any database or cryptographic work, so
 * an oversized payload cannot be used to burn server time.
 */
public record ForgotPasswordRequest(

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 320, message = "Email must be at most 320 characters")
        String email
) {
}