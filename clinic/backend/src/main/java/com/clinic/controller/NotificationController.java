package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.response.NotificationResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.NotificationType;
import com.clinic.exception.BadRequestException;
import com.clinic.security.CurrentUser;
import com.clinic.service.NotificationQuery;
import com.clinic.service.NotificationService;
import com.clinic.service.impl.NotificationStreamService;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Notification endpoints. Every action is scoped to the caller's identity taken
 * from the JWT — no endpoint accepts a recipient id, so notifications cannot be
 * read or marked by another user.
 */
@RestController
@RequestMapping(ApiPaths.NOTIFICATIONS)
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationStreamService streamService;
    private final CurrentUser currentUser;

    public NotificationController(NotificationService notificationService,
                                  NotificationStreamService streamService,
                                  CurrentUser currentUser) {
        this.notificationService = notificationService;
        this.streamService = streamService;
        this.currentUser = currentUser;
    }

    /**
     * The caller's own notifications, newest first.
     *
     * <p>{@code type} and {@code read} narrow the list and are both optional. They
     * are intersected with the recipient scope inside the query rather than applied
     * afterwards, so a filter can never widen what a caller sees.
     *
     * <p>An unknown {@code type} is rejected rather than ignored: silently treating
     * a typo as "no filter" returns the unfiltered list, which is a confusing way
     * to say "that category does not exist".
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Boolean read,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable
    ) {
        Page<NotificationResponse> page = notificationService.listForCurrentUser(
                new NotificationQuery(parseType(type), read), pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    /** @return the requested category, or {@code null} for "all categories" */
    private static NotificationType parseType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return NotificationType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Unknown notification type '" + raw + "'. Valid values are: "
                    + Arrays.stream(NotificationType.values())
                            .map(Enum::name)
                            .collect(Collectors.joining(", ")) + ".");
        }
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Long> unreadCount() {
        return ResponseEntity.ok(notificationService.unreadCountForCurrentUser());
    }

    @PatchMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<NotificationResponse> markRead(@PathVariable String id) {
        return ResponseEntity.ok(notificationService.markRead(id));
    }

    @PatchMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Integer> markAllRead() {
        return ResponseEntity.ok(notificationService.markAllRead());
    }

    /**
     * Server-Sent Events stream for real-time delivery.
     *
     * <p>EventSource cannot set an Authorization header, so the JWT may be
     * supplied as {@code ?token=}. The query-string token is accepted only here,
     * and it is validated exactly like the header.
     */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream() {
        var principal = currentUser.require();
        SseEmitter emitter = streamService.register(principal.getUserId(), principal.getUser().getRole());
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .body(emitter);
    }
}