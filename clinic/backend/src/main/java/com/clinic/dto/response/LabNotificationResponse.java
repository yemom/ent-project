package com.clinic.dto.response;

import java.time.LocalDateTime;

public record LabNotificationResponse(
        String id,
        String userId,
        String type,
        String message,
        String labOrderId,
        String labResultId,
        Boolean isRead,
        LocalDateTime createdAt) {
}
