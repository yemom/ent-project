package com.clinic.dto.response;

import java.time.LocalDateTime;
import java.time.LocalTime;

public record DoctorAvailabilityResponse(
        String id,
        String doctorId,
        String doctorName,
        String laboratoryId,
        String laboratoryName,
        String dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        Boolean isAvailable,
        Integer maxPatients,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
