package com.clinic.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDateTime;

/**
 * A new booking.
 *
 * <p>{@code appointmentDate} carries no {@code @JsonFormat} on purpose. An earlier
 * revision pinned {@code yyyy-MM-dd'T'HH:mm:ss}, which silently rejected the equally
 * valid ISO-8601 {@code 2026-10-19T09:00} that {@code LocalDateTime.toString()}
 * produces when the seconds are zero — and the API answered with a generic
 * "Failed to read request" instead of anything a form could show a user. Jackson's
 * standard local date-time reader accepts both forms and fractional seconds, so the
 * wire contract is strictly wider than it was and unchanged for existing callers.
 *
 * <p>{@code status} is a string rather than the enum so an unrecognised value is
 * rejected by the service with a message naming the valid statuses, instead of
 * failing to deserialise into an opaque 400.
 */
public record AppointmentCreateRequest(
        @NotNull(message = "Patient ID is required")
        String patientId,

        @NotNull(message = "Doctor ID is required")
        String doctorId,

        @NotNull(message = "Appointment date is required")
        LocalDateTime appointmentDate,

        @NotNull(message = "Duration is required")
        @Positive(message = "Duration must be positive")
        Integer duration,

        String status,
        String reasonForVisit,
        String notes
) {
}
