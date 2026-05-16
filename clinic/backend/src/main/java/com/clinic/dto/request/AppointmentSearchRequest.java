package com.clinic.dto.request;

import com.clinic.entity.AppointmentStatus;

import java.time.LocalDateTime;

public record AppointmentSearchRequest(
        String patientId,
        String doctorId,
        AppointmentStatus status,
        LocalDateTime from,
        LocalDateTime to,
        String keyword
) {
}
