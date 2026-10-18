package com.clinic.dto.request;

import com.clinic.entity.AppointmentStatus;
import jakarta.validation.constraints.NotNull;

/**
 * A requested move to another point in the appointment lifecycle.
 *
 * <p>Separate from {@link AppointmentUpdateRequest} on purpose: rescheduling a slot
 * and reporting on a visit are different decisions with different rules, and
 * merging them into one payload is how a cancelled appointment gets silently
 * resurrected by a form that happens to send every field it has.
 */
public record AppointmentStatusRequest(
        @NotNull(message = "Status is required")
        AppointmentStatus status,

        String reason
) {
}