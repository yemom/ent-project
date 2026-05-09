package com.clinic.dto.request;

import java.time.LocalDate;
import java.util.UUID;

public record MedicalRecordUpdateRequest(
        UUID patientId,
        UUID doctorId,
        UUID appointmentId,
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
        Boolean confidential
) {
}
