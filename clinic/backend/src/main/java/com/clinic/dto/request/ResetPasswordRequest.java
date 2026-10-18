package com.clinic.dto.request;

import com.clinic.validation.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Redeem a reset token and set a new password.
 *
 * @param token       the token exactly as it appeared in the reset link
 * @param newPassword the replacement, held to the same policy as registration
 */
public record ResetPasswordRequest(

        @NotBlank(message = "Reset token is required")
        @Size(max = 512, message = "Reset token is not valid")
        String token,

        @NotBlank(message = "A new password is required")
        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
        String newPassword
) {
}