package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * An append-only record of AI use.
 *
 * <p>Held to the same standard as {@link AuditLog}: identity, action, timestamp,
 * the authorised resource identifiers involved, and the outcome.
 *
 * <p>What it deliberately does not hold is the content. No prompt, no completion,
 * no clinical text, no token, no API key. Those live in {@link AiMessage}, which is
 * scoped by conversation ownership; this table is answerable to a compliance
 * question without exposing anyone's care.
 *
 * <p>{@code resourceIds} is a short, comma-joined list of identifiers the turn was
 * authorised against — for example the appointment ids included in a summary.
 * Identifiers, not content: enough to retrace the access, not enough to reconstruct
 * the patient.
 */
@Entity
@Table(name = "ai_audit_events", indexes = {
        @Index(name = "idx_ai_audit_user", columnList = "user_id"),
        @Index(name = "idx_ai_audit_created", columnList = "created_at"),
        @Index(name = "idx_ai_audit_action", columnList = "action_type")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAuditEvent {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "user_role", nullable = false, length = 32)
    private String userRole;

    /** {@code CHAT}, {@code CAPABILITIES}, {@code TOOL_INVOKED}, {@code ACTION_CONFIRMED}, … */
    @Column(name = "action_type", nullable = false, length = 40)
    private String actionType;

    @Column(name = "outcome", nullable = false, length = 20)
    private String outcome;

    /** Comma-joined authorised resource ids. Never free text. */
    @Column(name = "resource_ids", length = 500)
    private String resourceIds;

    /**
     * Latency and token counts only.
     *
     * <p>Enough to spot a cost or latency regression; cannot carry content.
     */
    @Column(name = "prompt_tokens")
    private Integer promptTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @Column(name = "duration_ms")
    private Long durationMs;

    /**
     * Retained, self-destructing audit rows.
     *
     * <p>Long enough to answer "who accessed what, and when" during a review;
     * short enough that the log is not a second clinical record store.
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}