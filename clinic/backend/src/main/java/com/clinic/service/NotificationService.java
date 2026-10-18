package com.clinic.service;

import com.clinic.dto.response.NotificationResponse;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Set;

/**
 * Read access to the caller's own notifications, plus internal emit helpers.
 *
 * <p>All read methods scope to the authenticated principal. There is no method
 * that accepts a user id from the client, which is what stops one user reading
 * another's notifications.
 */
public interface NotificationService {

    Page<NotificationResponse> listForCurrentUser(Pageable pageable);

    long unreadCountForCurrentUser();

    NotificationResponse markRead(String id);

    int markAllRead();

    /** Fan-out to every active user holding one of the roles. */
    int notifyRoles(Set<UserRole> roles, NotificationType type, String title, String message,
                    String referenceId, String link);

    /**
     * Idempotent fan-out.
     *
     * <p>Same as {@link #notifyRoles}, but each row carries an event key derived
     * from the event and the role, so an event already announced to that role is
     * skipped. Use this for anything a user action can trigger twice.
     *
     * @return how many rows were actually written; {@code 0} means all were already
     *         announced
     */
    int notifyRolesOnce(Set<UserRole> roles, NotificationType type, String title, String message,
                        String referenceId, String link, String eventType, String discriminator);

    /** Fan-out to a specific set of users. */
    int notifyUsers(Set<String> userIds, NotificationType type, String title, String message,
                    String referenceId, String link);

    /**
     * Idempotent fan-out to specific users.
     *
     * <p>Per recipient rather than per event: each user gets their own key, so the
     * doctor, the patient and reception are each notified once and none of them
     * suppresses the others.
     *
     * @return how many rows were written; {@code 0} means every recipient had
     *         already been told
     */
    int notifyUsersOnce(Set<String> userIds, NotificationType type, String title, String message,
                        String referenceId, String link, String eventType, String discriminator);

    NotificationResponse createForUser(String userId, NotificationType type, String title, String message,
                                       String referenceId, String link);

    /**
     * Idempotent single-recipient notification.
     *
     * @return the notification, or {@code null} if this recipient has already been
     *         told about this event
     */
    NotificationResponse createForUserOnce(String userId, NotificationType type, String title, String message,
                                           String referenceId, String link, String eventType,
                                           String discriminator);
}