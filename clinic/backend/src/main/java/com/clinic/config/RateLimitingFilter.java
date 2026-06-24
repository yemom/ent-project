package com.clinic.config;

import com.clinic.exception.ApiErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final String AUTH_PATH_PREFIX = "/api/v1/auth";
    private static final String LEGACY_AUTH_PATH_PREFIX = "/api/auth";

    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;
    private final ConcurrentMap<String, RequestWindow> windows = new ConcurrentHashMap<>();

    public RateLimitingFilter(RateLimitProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.isEnabled() || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        return properties.getProtectedPathPrefixes().stream().noneMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        int limit = isAuthPath(path) ? properties.getAuthRequests() : properties.getRequests();
        long now = System.currentTimeMillis();
        long windowMillis = properties.getWindow().toMillis();
        String key = buildKey(request, isAuthPath(path));

        RateLimitResult result = consume(key, limit, now, windowMillis);
        applyHeaders(response, result);

        if (!result.allowed()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), new ApiErrorResponse(
                    Instant.now(),
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    "Too many requests. Please try again later.",
                    path
            ));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private RateLimitResult consume(String key, int limit, long now, long windowMillis) {
        RequestWindow window = windows.compute(key, (ignored, current) -> {
            if (current == null || now >= current.resetAt()) {
                return new RequestWindow(now + windowMillis, 1);
            }
            return new RequestWindow(current.resetAt(), current.used() + 1);
        });

        cleanupExpiredWindows(now);
        int remaining = Math.max(0, limit - window.used());
        return new RateLimitResult(window.used() <= limit, limit, remaining, window.resetAt());
    }

    private void applyHeaders(HttpServletResponse response, RateLimitResult result) {
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(result.resetAtEpochSeconds()));
        if (!result.allowed()) {
            long retryAfterSeconds = Math.max(1, result.resetAtEpochSeconds() - Instant.now().getEpochSecond());
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        }
    }

    private String buildKey(HttpServletRequest request, boolean authPath) {
        String client = resolveClientIp(request);
        String scope = authPath ? "auth" : "api";
        return scope + ":" + client;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }

    private boolean isAuthPath(String path) {
        String normalizedPath = path.toLowerCase(Locale.ROOT);
        return normalizedPath.startsWith(AUTH_PATH_PREFIX) || normalizedPath.startsWith(LEGACY_AUTH_PATH_PREFIX);
    }

    private void cleanupExpiredWindows(long now) {
        if (windows.size() < 10_000) {
            return;
        }
        windows.entrySet().removeIf(entry -> now >= entry.getValue().resetAt());
    }

    private record RequestWindow(long resetAt, int used) {
    }

    private record RateLimitResult(boolean allowed, int limit, int remaining, long resetAtMillis) {
        long resetAtEpochSeconds() {
            return resetAtMillis / 1000;
        }
    }
}
