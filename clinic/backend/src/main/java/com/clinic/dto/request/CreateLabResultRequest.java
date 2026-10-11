package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * @param critical whether the result is clinically critical. Optional and defaults
 *                 to false so existing clients keep working; the laboratory sets it
 *                 when it sees a value that needs urgent clinician attention.
 */
public record CreateLabResultRequest(
        @NotNull(message = "Lab Order ID is required") String labOrderId,
        @NotNull(message = "Lab Technician ID is required") String labTechnicianId,
        @NotBlank(message = "Findings are required") String findings,
        String fileUrl,
        String status,
        Boolean critical) {
}
