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
 * One turn of an AI conversation.
 *
 * <p>{@code contextSnapshot} holds the data that was authorised and shown to the
 * model for this turn. It is stored so an answer can be re-checked later against
 * the facts it was based on — but it is <em>not</em> shown back to the user by
 * default, and it is only ever reachable through an owner-scoped query for the
 * caller's own conversation.
 */
@Entity
@Table(name = "ai_messages", indexes = {
        @Index(name = "idx_ai_messages_conversation", columnList = "conversation_id"),
        @Index(name = "idx_ai_messages_created", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMessage {

    public static final String ROLE_USER = "USER";
    public static final String ROLE_ASSISTANT = "ASSISTANT";

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "conversation_id", nullable = false, length = 36)
    private String conversationId;

    /** {@code USER} or {@code ASSISTANT}. Constrained by a check constraint in the migration. */
    @Column(name = "role", nullable = false, length = 16)
    private String role;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * The authorised context this answer was computed from.
     *
     * <p>Absent when a turn needed no data. Stored so an answer remains auditable
     * after the underlying records have changed.
     */
    @Column(name = "context_snapshot", columnDefinition = "TEXT")
    private String contextSnapshot;

    /**
     * Whether this turn drew on patient-identifiable data.
     *
     * <p>What a privacy review asks first, and the reason
     * {@code AI_ALLOW_IDENTIFIABLE_DATA} exists as an explicit opt-in.
     */
    @Builder.Default
    @Column(name = "contained_identifiable_data", nullable = false)
    private Boolean containedIdentifiableData = false;

    /** Set when the answer reports a clinician must verify it before use. */
    @Builder.Default
    @Column(name = "requires_human_review", nullable = false)
    private Boolean requiresHumanReview = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}