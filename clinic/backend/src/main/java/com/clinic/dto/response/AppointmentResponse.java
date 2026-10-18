package com.clinic.dto.response;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;

public record AppointmentResponse(
        String id,
        AppointmentPartyResponse patient,
        AppointmentPartyResponse doctor,
        LocalDateTime appointmentDate,
        Integer duration,
        AppointmentStatus status,
        String reasonForVisit,
        String notes,
        Boolean reminderSent,
        LocalDateTime reminderSentAt,
        String cancelledBy,
        String cancellationReason,
        LocalDateTime cancellationDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
