package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateLabResultRequest(
        @NotBlank(message = "Findings are required") String findings,
        String fileUrl) {
}
