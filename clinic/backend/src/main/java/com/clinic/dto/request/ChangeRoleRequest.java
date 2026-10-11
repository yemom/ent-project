package com.clinic.dto.request;

import com.clinic.entity.UserRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Changes an account's role.
 *
 * <p>Separate from {@link UpdateUserRequest} on purpose. A profile edit is a
 * routine correction; a role change alters what the account can reach, so it gets
 * its own audited endpoint rather than riding along on a form save.
 */
public record ChangeRoleRequest(
        @NotNull(message = "Role is required")
        UserRole role,

        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {
}