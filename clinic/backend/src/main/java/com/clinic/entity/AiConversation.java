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
 * One AI conversation, owned by exactly one user.
 *
 * <p>Ownership is the access-control boundary for this feature: a conversation is
 * readable and writable only by the user who started it. That is enforced in the
 * repository query rather than by filtering in the service, so a bug in the service
 * still cannot return another user's history.
 *
 * <p>{@code ownerRole} is recorded for audit: it captures what the caller's role
 * was when the conversation was opened, which is what makes an AI-assisted action
 * traceable afterwards. It is never used to authorise anything — the role is read
 * from the live principal on every request.
 */
@Entity
@Table(name = "ai_conversations", indexes = {
        @Index(name = "idx_ai_conversations_owner", columnList = "owner_user_id"),
        @Index(name = "idx_ai_conversations_updated", columnList = "updated_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiConversation {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    /** The user who started it. Every read and write is scoped by this column. */
    @Column(name = "owner_user_id", nullable = false, length = 36)
    private String ownerUserId;

    @Column(name = "owner_role", nullable = false, length = 32)
    private String ownerRole;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * {@code @Builder.Default} is required, not decorative: Lombok's builder
     * discards a field's initialiser unless it is annotated, so without this the
     * column would be written as {@code null} and fail a {@code NOT NULL}
     * constraint on the first insert.
     */
    @Builder.Default
    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;
}