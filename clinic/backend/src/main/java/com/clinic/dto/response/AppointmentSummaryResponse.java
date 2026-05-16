package com.clinic.dto.response;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;

public record AppointmentSummaryResponse(
        String id,
        LocalDateTime appointmentDate,
        Integer duration,
        AppointmentStatus status,
        String reasonForVisit
) {
}
