package com.clinic.dto.response;

import java.time.LocalDateTime;

/**
 * A conversation header, without its turns.
 */
public record AiConversationResponse(
        String id,
        String title,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}