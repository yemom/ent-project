package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreatePrescriptionOrderRequest(
        @NotNull(message = "Doctor ID is required") String doctorId,

        @NotBlank(message = "Doctor name is required") String doctorName,

        @NotBlank(message = "Patient name is required") String patientName,

        @NotBlank(message = "Drug name is required") String drugName,

        @NotBlank(message = "Dosage is required") String dosage,

        String instructions) {
}
