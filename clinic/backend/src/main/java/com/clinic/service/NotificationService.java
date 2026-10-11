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

    /** Fan-out to a specific set of users. */
    int notifyUsers(Set<String> userIds, NotificationType type, String title, String message,
                    String referenceId, String link);

    NotificationResponse createForUser(String userId, NotificationType type, String title, String message,
                                       String referenceId, String link);
}