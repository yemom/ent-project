package com.clinic.dto.response;

import java.time.Instant;
import java.util.Set;

/**
 * Login result. Carries the caller's permission set so the frontend can filter
 * navigation and guard routes from exactly the same list the API enforces,
 * instead of duplicating the role matrix in TypeScript.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        Instant expiresAt,
        UserSummaryResponse user,
        Set<String> permissions
) {
    public static AuthResponse of(String accessToken, Instant expiresAt, UserSummaryResponse user) {
        return of(accessToken, null, expiresAt, user, Set.of());
    }

    public static AuthResponse of(String accessToken, String refreshToken, Instant expiresAt,
                                  UserSummaryResponse user, Set<String> permissions) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", expiresAt, user, permissions);
    }
}