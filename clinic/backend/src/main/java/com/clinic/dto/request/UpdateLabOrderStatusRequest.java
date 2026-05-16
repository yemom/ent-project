package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateLabOrderStatusRequest(
        @NotBlank(message = "Status is required") String status) {
}
