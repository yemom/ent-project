package com.clinic.service.impl;

import java.util.Set;

/**
 * Raised after new notification rows are persisted so the SSE broker can push
 * them to connected clients immediately instead of waiting for the next poll.
 */
public record NotificationEmittedEvent(
        com.clinic.entity.NotificationType type,
        String referenceId,
        String link,
        Set<String> targetUserIds
) {
    /** True when the event was addressed to every holder of a role. */
    public boolean broadcast() {
        return targetUserIds != null && targetUserIds.isEmpty();
    }
}