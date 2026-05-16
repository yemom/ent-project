package com.clinic.dto.request;

import java.time.LocalDate;

public record MedicalRecordSearchRequest(
        String patientId,
        String doctorId,
        String appointmentId,
        LocalDate fromDate,
        LocalDate toDate,
        Boolean confidential,
        String keyword
) {
}
