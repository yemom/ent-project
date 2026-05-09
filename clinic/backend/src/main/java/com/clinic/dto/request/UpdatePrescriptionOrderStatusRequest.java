package com.clinic.dto.request;

import com.clinic.entity.PrescriptionOrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePrescriptionOrderStatusRequest(
        @NotNull(message = "Status is required") PrescriptionOrderStatus status) {
}
