package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateLabResultStatusRequest(
        @NotBlank(message = "Status is required") String status) {
}
