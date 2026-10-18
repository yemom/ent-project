package com.clinic.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One assistant turn.
 *
 * <p>Carries the evidence alongside the answer on purpose: {@link #sources()} and
 * {@link #computedAt()} let the reader check the claim, and
 * {@link #requiresHumanReview()} plus {@link #reviewNotice()} make it impossible to
 * mistake a generated draft for a clinical fact.
 *
 * @param conversationId             the conversation this turn belongs to
 * @param answer                     the generated text, as text and never as HTML
 * @param requiresHumanReview        true when the answer touches clinical content
 * @param reviewNotice               what a reviewer must do, or null
 * @param sources                    where the underlying numbers came from
 * @param computedAt                 when those numbers were computed
 * @param containsIdentifiableData   whether patient-identifiable data was involved
 * @param urgentConcernDetected      true when the question may describe an emergency
 */
public record AiChatResponse(
        String conversationId,
        String answer,
        boolean requiresHumanReview,
        String reviewNotice,
        List<String> sources,
        LocalDateTime computedAt,
        boolean containsIdentifiableData,
        boolean urgentConcernDetected
) {
}