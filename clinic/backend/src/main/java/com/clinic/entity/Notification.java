package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * In-app notification delivered to a single user or to every holder of a role.
 *
 * <p>Replaces the lab-specific {@link LabNotification} so one entity covers all
 * notification flows: lab orders, lab results, patient assignment, and future
 * events. Recipients are resolved at read time from the JWT, never from the
 * request body, so a client cannot read another user's notifications.
 *
 * <p>Fields: recipientUserId, recipientRole, type, title, message, referenceId,
 * link, readAt.
 */
@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notifications_user_read", columnList = "recipient_user_id, read_at"),
        @Index(name = "idx_notifications_role_read", columnList = "recipient_role, read_at"),
        @Index(name = "idx_notifications_type_ref", columnList = "type, reference_id"),
        @Index(name = "idx_notifications_created", columnList = "created_at DESC")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class Notification extends BaseEntity {

    /** When null, {@link #recipientRole} must be set. */
    @Column(name = "recipient_user_id", length = 36)
    private String recipientUserId;

    /** Broadcast target. When null, {@link #recipientUserId} must be set. */
    @Enumerated(EnumType.STRING)
    @Column(name = "recipient_role", length = 20)
    private UserRole recipientRole;

    @NotNull(message = "Type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 40)
    private NotificationType type = NotificationType.SYSTEM;

    @NotBlank(message = "Title is required")
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @NotBlank(message = "Message is required")
    @Column(name = "message", columnDefinition = "TEXT", nullable = false)
    private String message;

    /** Id of the related record (lab order, patient, appointment…). */
    @Column(name = "reference_id", length = 36)
    private String referenceId;

    /** Frontend route opened when the notification is clicked. */
    @Column(name = "link", length = 255)
    private String link;

    /** Null means unread. */
    @Column(name = "read_at")
    private Instant readAt;

    public boolean isRead() {
        return readAt != null;
    }

    public void markRead() {
        if (readAt == null) {
            readAt = Instant.now();
        }
    }

    public void markUnread() {
        readAt = null;
    }

    public static Notification forUser(String userId, NotificationType type, String title, String message) {
        return Notification.builder()
                .recipientUserId(userId)
                .type(type)
                .title(title)
                .message(message)
                .build();
    }

    public static Notification forRole(UserRole role, NotificationType type, String title, String message) {
        return Notification.builder()
                .recipientRole(role)
                .type(type)
                .title(title)
                .message(message)
                .build();
    }
}