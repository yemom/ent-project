package com.clinic.service.impl;

import com.clinic.dto.response.NotificationResponse;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.NotificationRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.NotificationEventKey;
import com.clinic.service.NotificationQuery;
import com.clinic.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Notification reads and fan-out.
 *
 * <p>Every read is scoped to the authenticated principal; there is deliberately no
 * method that takes a recipient id from the client.
 */
@Service
@Transactional
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final ApplicationEventPublisher eventPublisher;

    public NotificationServiceImpl(NotificationRepository notificationRepository,
                                   UserRepository userRepository,
                                   CurrentUser currentUser,
                                   ApplicationEventPublisher eventPublisher) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> listForCurrentUser(NotificationQuery query, Pageable pageable) {
        var principal = currentUser.require();
        NotificationQuery effective = query == null ? NotificationQuery.ALL : query;
        return notificationRepository
                .findVisibleTo(principal.getUserId(), principal.getUser().getRole(),
                        effective.type(), effective.read(), pageable)
                .map(NotificationResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public long unreadCountForCurrentUser() {
        var principal = currentUser.require();
        return notificationRepository.countUnreadFor(
                principal.getUserId(), principal.getUser().getRole());
    }

    @Override
    public NotificationResponse markRead(String id) {
        var principal = currentUser.require();
        Notification notification = notificationRepository
                .findVisibleById(principal.getUserId(), principal.getUser().getRole(), id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));

        notification.markRead();
        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Override
    public int markAllRead() {
        var principal = currentUser.require();
        int updated = notificationRepository.markAllReadFor(
                principal.getUserId(), principal.getUser().getRole(), Instant.now());
        log.debug("Marked {} notifications read for user {}", updated, principal.getUserId());
        return updated;
    }

    @Override
    public int notifyRoles(Set<UserRole> roles, NotificationType type, String title, String message,
                           String referenceId, String link) {
        if (roles == null || roles.isEmpty()) {
            return 0;
        }
        // One row per role. Reads fan out to every holder of that role, so a newly
        // added member sees earlier broadcasts without needing a backfill.
        List<Notification> rows = roles.stream()
                .map(role -> Notification.builder()
                        .recipientRole(role)
                        .type(type)
                        .title(title)
                        .message(message)
                        .referenceId(referenceId)
                        .link(link)
                        .build())
                .toList();
        notificationRepository.saveAll(rows);

        // Push only to the members who should actually see it.
        Set<String> audience = activeUserIdsForRoles(roles);
        eventPublisher.publishEvent(new NotificationEmittedEvent(type, referenceId, link, audience));

        log.info("Created {} role notification row(s) type={} referenceId={} audience={}",
                rows.size(), type, referenceId, audience.size());
        return rows.size();
    }

    @Override
    public int notifyUsers(Set<String> userIds, NotificationType type, String title, String message,
                           String referenceId, String link) {
        if (userIds == null || userIds.isEmpty()) {
            return 0;
        }
        List<Notification> rows = userIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .map(id -> Notification.builder()
                        .recipientUserId(id)
                        .type(type)
                        .title(title)
                        .message(message)
                        .referenceId(referenceId)
                        .link(link)
                        .build())
                .toList();
        notificationRepository.saveAll(rows);
        eventPublisher.publishEvent(
                new NotificationEmittedEvent(type, referenceId, link, Set.copyOf(userIds)));
        log.info("Created {} user notification(s) type={} referenceId={}", rows.size(), type, referenceId);
        return rows.size();
    }

    @Override
    public NotificationResponse createForUser(String userId, NotificationType type, String title, String message,
                                              String referenceId, String link) {
        Notification saved = notificationRepository.save(Notification.builder()
                .recipientUserId(userId)
                .type(type)
                .title(title)
                .message(message)
                .referenceId(referenceId)
                .link(link)
                .build());
        eventPublisher.publishEvent(
                new NotificationEmittedEvent(type, referenceId, link, Set.of(userId)));
        return NotificationResponse.from(saved);
    }

    /**
     * Idempotent fan-out to specific users.
     *
     * <p>Keys are built per recipient, so the doctor, the patient and reception are
     * each recorded once and none of them suppresses the others. An already-announced
     * recipient is skipped and not counted, so the return value is the number of
     * notifications actually shown rather than the number attempted.
     */
    @Override
    public int notifyUsersOnce(Set<String> userIds, NotificationType type, String title, String message,
                               String referenceId, String link, String eventType, String discriminator) {
        if (userIds == null || userIds.isEmpty()) {
            return 0;
        }

        Set<String> audience = userIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());

        List<Notification> rows = audience.stream()
                .map(recipientId -> Notification.builder()
                        .recipientUserId(recipientId)
                        .type(type)
                        .title(title)
                        .message(message)
                        .referenceId(referenceId)
                        .link(link)
                        .eventKey(NotificationEventKey.of(eventType, referenceId, discriminator, recipientId, null))
                        .build())
                .filter(this::claimEventKey)
                .toList();

        if (rows.isEmpty()) {
            log.debug("All recipients already notified for eventType={} referenceId={}", eventType, referenceId);
            return 0;
        }

        notificationRepository.saveAll(rows);
        eventPublisher.publishEvent(new NotificationEmittedEvent(
                type, referenceId, link,
                rows.stream().map(Notification::getRecipientUserId).collect(Collectors.toSet())));

        log.info("Created {} user notification(s) type={} referenceId={} eventType={}",
                rows.size(), type, referenceId, eventType);
        return rows.size();
    }

    /**
     * Idempotent fan-out to roles.
     *
     * <p>Keyed per role rather than per user: a role broadcast is one row, so
     * there is nothing to deduplicate between its members.
     */
    @Override
    public int notifyRolesOnce(Set<UserRole> roles, NotificationType type, String title, String message,
                               String referenceId, String link, String eventType, String discriminator) {
        if (roles == null || roles.isEmpty()) {
            return 0;
        }

        List<Notification> rows = roles.stream()
                .map(role -> Notification.builder()
                        .recipientRole(role)
                        .type(type)
                        .title(title)
                        .message(message)
                        .referenceId(referenceId)
                        .link(link)
                        .eventKey(NotificationEventKey.of(eventType, referenceId, discriminator,
                                "role:" + role.name(), null))
                        .build())
                .filter(this::claimEventKey)
                .toList();

        if (rows.isEmpty()) {
            return 0;
        }

        notificationRepository.saveAll(rows);

        Set<String> audience = activeUserIdsForRoles(roles);
        eventPublisher.publishEvent(new NotificationEmittedEvent(type, referenceId, link, audience));

        log.info("Created {} role notification row(s) type={} referenceId={} eventType={}",
                rows.size(), type, referenceId, eventType);
        return rows.size();
    }

    @Override
    public NotificationResponse createForUserOnce(String userId, NotificationType type, String title,
                                                  String message, String referenceId, String link,
                                                  String eventType, String discriminator) {
        if (userId == null || userId.isBlank()) {
            return null;
        }

        Notification candidate = Notification.builder()
                .recipientUserId(userId)
                .type(type)
                .title(title)
                .message(message)
                .referenceId(referenceId)
                .link(link)
                .eventKey(NotificationEventKey.of(eventType, referenceId, discriminator, userId, null))
                .build();

        if (!claimEventKey(candidate)) {
            return null;
        }

        Notification saved = notificationRepository.save(candidate);
        eventPublisher.publishEvent(new NotificationEmittedEvent(type, referenceId, link, Set.of(userId)));
        return NotificationResponse.from(saved);
    }

    /**
     * Decides whether a notification has already been announced.
     *
     * <p>Check-then-insert is only safe because the unique index on
     * {@code event_key} is the real guarantee: two concurrent inserts both pass this
     * check, one loses at the database and is discarded. Returning {@code true} here
     * means "not seen yet", not "reserved".
     */
    private boolean claimEventKey(Notification notification) {
        String eventKey = notification.getEventKey();
        if (eventKey == null || eventKey.isBlank()) {
            return true; // nothing to deduplicate against
        }
        return !notificationRepository.existsByEventKey(eventKey);
    }

    /** Active user ids holding any of the given roles. */
    private Set<String> activeUserIdsForRoles(Set<UserRole> roles) {
        return userRepository.findAllByRoleInAndActiveTrue(roles).stream()
                .map(user -> user.getId())
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
    }
}