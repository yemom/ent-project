package com.clinic.service.impl;

import com.clinic.entity.UserRole;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-process SSE broker for notifications.
 *
 * <p>SSE is used rather than WebSocket because it is a plain HTTP response:
 * it works through Render's proxy without sticky sessions or an extra socket
 * layer, and the browser reconnects on its own. Clients still poll as a
 * fallback, so a missed push is never a lost notification.
 *
 * <p>Emitters are registered per authenticated user id, so a push only reaches
 * the sessions that should see it.
 */
@Component
public class NotificationStreamService {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<String, Set<SseEmitter>> emittersByUser = new ConcurrentHashMap<>();

    /** Registers a stream for a user; the emitter is cleaned up when it closes. */
    public SseEmitter register(String userId, UserRole role) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Set<SseEmitter> emitters = emittersByUser.computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet());
        emitters.add(emitter);

        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> remove(userId, emitter));
        emitter.onError(throwable -> remove(userId, emitter));

        try {
            emitter.send(SseEmitter.event().name("connected")
                    .data(Map.of("userId", userId, "role", role != null ? role.name() : "UNKNOWN")));
        } catch (IOException e) {
            remove(userId, emitter);
        }

        return emitter;
    }

    /** Pushes a refresh hint to the given users. Best-effort; never throws. */
    public void push(Set<String> userIds, NotificationEmittedEvent event) {
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        userIds.forEach(userId -> send(userId, emittersByUser.get(userId), event));
    }

    public int activeStreamCount() {
        return emittersByUser.values().stream().mapToInt(Set::size).sum();
    }

    @EventListener
    public void onNotification(NotificationEmittedEvent event) {
        push(event.targetUserIds(), event);
    }

    private void send(String userId, Set<SseEmitter> emitters, NotificationEmittedEvent event) {
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        Map<String, Object> payload = Map.of(
                "type", event.type() != null ? event.type().name() : "SYSTEM",
                "referenceId", event.referenceId() != null ? event.referenceId() : "",
                "link", event.link() != null ? event.link() : ""
        );
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(payload));
            } catch (IOException | IllegalStateException e) {
                remove(userId, emitter);
            }
        }
    }

    private void remove(String userId, SseEmitter emitter) {
        Set<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByUser.remove(userId);
        }
    }
}