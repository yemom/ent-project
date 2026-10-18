package com.clinic.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ask the assistant to prepare an appointment change for review.
 *
 * <p>A typed request rather than free text, because this is the one path where the
 * assistant leads to a write. A language model emitting a booking as text would be
 * emitting a string; validating a typed request instead means the proposal is
 * something the server understands and can refuse.
 *
 * @param type             BOOK, RESCHEDULE or CANCEL
 * @param conversationId   the conversation this belongs to, for context
 * @param patientId        required for BOOK
 * @param doctorId         required for BOOK
 * @param appointmentId    required for RESCHEDULE and CANCEL
 * @param appointmentDate  ISO-8601 local date-time; required for BOOK and RESCHEDULE
 * @param durationMinutes  appointment length; defaults to 30
 * @param reason           reason for visit, or the cancellation reason
 */
public record AiProposeActionRequest(

        @NotBlank(message = "An action type is required")
        @Size(max = 40)
        String type,

        @Size(max = 64)
        String conversationId,

        @Size(max = 64)
        String patientId,

        @Size(max = 64)
        String doctorId,

        @Size(max = 64)
        String appointmentId,

        @Size(max = 40)
        String appointmentDate,

        @Min(5) @Max(480)
        Integer durationMinutes,

        @Size(max = 500)
        String reason
) {
}