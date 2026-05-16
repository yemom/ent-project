package com.clinic.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MedicalRecordCreateRequest(
        @NotNull(message = "Patient ID is required")
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

        @NotNull(message = "Record date is required")
        LocalDate recordDate,

        String medicalRecordType,
        Boolean confidential
) {
}
