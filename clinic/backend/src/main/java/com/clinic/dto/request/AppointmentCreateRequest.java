package com.clinic.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDateTime;

public record AppointmentCreateRequest(
        @NotNull(message = "Patient ID is required")
        String patientId,

        @NotNull(message = "Doctor ID is required")
        String doctorId,

        @NotNull(message = "Appointment date is required")
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime appointmentDate,

        @NotNull(message = "Duration is required")
        @Positive(message = "Duration must be positive")
        Integer duration,

        String status,
        String reasonForVisit,
        String notes
) {
}
