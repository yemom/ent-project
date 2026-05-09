package com.clinic.dto.request;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record AppointmentSearchRequest(
        UUID patientId,
        UUID doctorId,
        AppointmentStatus status,
        LocalDateTime from,
        LocalDateTime to,
        String keyword
) {
}
