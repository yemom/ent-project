package com.clinic.dto.response;

import java.time.LocalDateTime;

/**
 * One turn in the caller's own conversation.
 *
 * <p>Only reachable through an owner-scoped repository query, so returning this
 * cannot expose anyone else's history.
 *
 * @param requiresHumanReview whether a clinician must sign this off
 * @param draft               true when the answer is AI-generated and unverified
 */
public record AiMessageResponse(
        String id,
        String role,
        String content,
        LocalDateTime createdAt,
        boolean requiresHumanReview,
        boolean draft
) {
}