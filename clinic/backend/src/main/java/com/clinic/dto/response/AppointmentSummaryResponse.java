package com.clinic.dto.response;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record AppointmentSummaryResponse(
        UUID id,
        LocalDateTime appointmentDate,
        Integer duration,
        AppointmentStatus status,
        String reasonForVisit
) {
}
