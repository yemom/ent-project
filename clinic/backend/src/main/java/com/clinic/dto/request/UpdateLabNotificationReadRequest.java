package com.clinic.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateLabNotificationReadRequest(
        @NotNull(message = "IsRead flag is required") Boolean isRead) {
}
