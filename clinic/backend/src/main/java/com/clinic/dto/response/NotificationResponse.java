package com.clinic.dto.response;

import com.clinic.entity.Notification;

import java.time.Instant;

public record NotificationResponse(
        String id,
        String type,
        String title,
        String message,
        String referenceId,
        String link,
        Instant readAt,
        boolean read,
        Instant createdAt
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType() != null ? notification.getType().name() : "SYSTEM",
                notification.getTitle(),
                notification.getMessage(),
                notification.getReferenceId(),
                notification.getLink(),
                notification.getReadAt(),
                notification.isRead(),
                notification.getCreatedAt() != null
                        ? notification.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toInstant()
                        : null
        );
    }
}