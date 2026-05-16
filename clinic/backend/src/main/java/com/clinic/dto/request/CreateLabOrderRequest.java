package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateLabOrderRequest(
        @NotNull(message = "Patient ID is required") String patientId,
        @NotNull(message = "Doctor ID is required") String doctorId,
        String appointmentId,
        @NotEmpty(message = "At least one test must be selected") List<String> tests,
        @NotBlank(message = "Urgency is required") String urgency,
        @NotBlank(message = "Clinical notes are required") String clinicalNotes) {
}
