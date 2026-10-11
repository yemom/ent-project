package com.clinic.service.impl;

import com.clinic.dto.response.NotificationResponse;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.NotificationRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
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
    public Page<NotificationResponse> listForCurrentUser(Pageable pageable) {
        var principal = currentUser.require();
        return notificationRepository
                .findVisibleTo(principal.getUserId(), principal.getUser().getRole(), pageable)
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

    /** Active user ids holding any of the given roles. */
    private Set<String> activeUserIdsForRoles(Set<UserRole> roles) {
        return userRepository.findAllByRoleInAndActiveTrue(roles).stream()
                .map(user -> user.getId())
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
    }
}