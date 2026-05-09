package com.clinic.dto.request;

import java.time.LocalDate;
import java.util.UUID;

public record MedicalRecordSearchRequest(
        UUID patientId,
        UUID doctorId,
        UUID appointmentId,
        LocalDate fromDate,
        LocalDate toDate,
        Boolean confidential,
        String keyword
) {
}
