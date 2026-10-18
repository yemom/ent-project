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
 * An AI state-changing operation that a human has been asked to approve.
 *
 * <p>This is the confirmation gate. The model may <em>propose</em> a booking, a
 * reschedule or a cancellation; nothing reaches the appointment service until the
 * owning user explicitly confirms, and even then {@code AiService} re-checks
 * availability, conflicts and permissions immediately before committing, because
 * the world may have moved between proposal and confirmation.
 *
 * <p>The payload is stored as JSON and is re-validated on confirmation. A
 * confirmed action is therefore never the result of trusting a stored blob.
 */
@Entity
@Table(name = "ai_pending_actions", indexes = {
        @Index(name = "idx_ai_pending_actions_owner", columnList = "owner_user_id"),
        @Index(name = "idx_ai_pending_actions_expiry", columnList = "expires_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiPendingAction {

    public static final String TYPE_BOOK_APPOINTMENT = "BOOK_APPOINTMENT";
    public static final String TYPE_RESCHEDULE = "RESCHEDULE_APPOINTMENT";
    public static final String TYPE_CANCEL = "CANCEL_APPOINTMENT";

    public static final String STATUS_PROPOSED = "PROPOSED";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_EXECUTED = "EXECUTED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    /** The only user who may confirm or reject this. */
    @Column(name = "owner_user_id", nullable = false, length = 36)
    private String ownerUserId;

    @Column(name = "conversation_id", nullable = false, length = 36)
    private String conversationId;

    @Column(name = "action_type", nullable = false, length = 40)
    private String actionType;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /** Human-readable summary of what would happen, for the confirmation screen. */
    @Column(name = "description", nullable = false, length = 500)
    private String description;

    /** JSON arguments. Re-validated on confirmation; never trusted as stored. */
    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    /** The result of a successful commit, for the audit trail. */
    @Column(name = "result_entity_id", length = 36)
    private String resultEntityId;

    @Column(name = "result_message", length = 500)
    private String resultMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    public boolean isPending() {
        return STATUS_PROPOSED.equals(status);
    }

    public boolean isExpiredAt(LocalDateTime now) {
        return expiresAt != null && !expiresAt.isAfter(now);
    }
}