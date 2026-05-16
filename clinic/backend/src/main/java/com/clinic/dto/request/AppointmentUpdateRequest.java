package com.clinic.dto.request;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;

public record AppointmentUpdateRequest(
        String patientId,
        String doctorId,
        LocalDateTime appointmentDate,
        Integer duration,
        AppointmentStatus status,
        String reasonForVisit,
        String notes,
        Boolean reminderSent,
        LocalDateTime reminderSentAt,
        String cancelledBy,
        String cancellationReason,
        LocalDateTime cancellationDate
) {
}
