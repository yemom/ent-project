package com.clinic.dto.request;

import java.time.LocalDate;

public record MedicalRecordUpdateRequest(
        String patientId,
        String doctorId,
        String appointmentId,
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
