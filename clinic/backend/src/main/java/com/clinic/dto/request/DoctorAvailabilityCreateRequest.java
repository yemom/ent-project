package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

public record DoctorAvailabilityCreateRequest(
        @NotBlank(message = "Doctor ID is required")
        String doctorId,

        @NotBlank(message = "Laboratory ID is required")
        String laboratoryId,

        @NotBlank(message = "Day of week is required")
        String dayOfWeek,

        @NotNull(message = "Start time is required")
        LocalTime startTime,

        @NotNull(message = "End time is required")
        LocalTime endTime,

        Boolean isAvailable,

        Integer maxPatients,

        String notes
) {
}
