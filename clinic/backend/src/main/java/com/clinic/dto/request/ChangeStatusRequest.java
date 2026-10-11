package com.clinic.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Activates or deactivates an account.
 *
 * <p>A reason is mandatory when deactivating. "Deactivated" without a reason is
 * indistinguishable from a bug six months later, and the whole point of suspending
 * someone's access is that it can be explained and reviewed.
 */
public record ChangeStatusRequest(
        @NotNull(message = "Active flag is required")
        Boolean active,

        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {
}