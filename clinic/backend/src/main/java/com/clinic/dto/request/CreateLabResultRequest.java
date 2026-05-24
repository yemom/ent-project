package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateLabResultRequest(
        @NotNull(message = "Lab Order ID is required") String labOrderId,
        @NotNull(message = "Lab Technician ID is required") String labTechnicianId,
        @NotBlank(message = "Findings are required") String findings,
        String fileUrl,
        String status) {
}
