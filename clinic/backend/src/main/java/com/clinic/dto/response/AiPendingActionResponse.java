package com.clinic.dto.response;

import java.time.LocalDateTime;

/**
 * A proposed change awaiting a human decision.
 *
 * <p>Returned by both the propose and the confirm endpoints so the UI can render
 * the same card in either state. The id here is an approval reference, not an
 * authorisation: it is only ever honoured for the user who created it.
 */
public record AiPendingActionResponse(
        String id,
        String type,
        String status,
        String description,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        String resultMessage,
        String appointmentId
) {

    /** True while the action can still be confirmed or rejected. */
    public boolean isAwaitingDecision() {
        return "PROPOSED".equals(status);
    }
}