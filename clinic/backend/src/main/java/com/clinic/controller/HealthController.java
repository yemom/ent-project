package com.clinic.controller;

import com.clinic.config.ApiPaths;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Lightweight liveness endpoint used by the frontend "wake-up" ping and by the
 * scheduled GitHub Actions keep-alive job.
 *
 * Deliberately performs NO database, cache or repository access so that it can
 * answer before Flyway/Hikari/Redis warm-up completes. That makes it a reliable
 * signal for "the HTTP listener is accepting connections".
 *
 * Readiness is a separate concern and stays on {@code /actuator/health}.
 */
@RestController
public class HealthController {

    /** Timestamp captured once the JVM finished booting; proves the context is fully initialised. */
    private static final Instant STARTED_AT = Instant.now();

    @GetMapping(ApiPaths.HEALTH)
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "clinic-backend",
                "startedAt", STARTED_AT.toString(),
                "uptimeSeconds", java.time.Duration.between(STARTED_AT, Instant.now()).toSeconds(),
                "timestamp", Instant.now().toString()
        ));
    }
}