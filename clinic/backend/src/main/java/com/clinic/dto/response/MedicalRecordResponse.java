package com.clinic.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record MedicalRecordResponse(
        UUID id,
        UserSummaryResponse patient,
        UserSummaryResponse doctor,
        AppointmentSummaryResponse appointment,
        String diagnosis,
        String treatment,
        String prescription,
        String testResults,
        String vitalSigns,
        Boolean followUpRequired,
        LocalDate followUpDate,
        String notes,
        LocalDate recordDate,
        String medicalRecordType,
        Boolean confidential,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
