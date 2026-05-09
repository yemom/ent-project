package com.clinic.dto.response;

import java.time.Instant;

public record AuthResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        UserSummaryResponse user
) {
    public static AuthResponse of(String accessToken, Instant expiresAt, UserSummaryResponse user) {
        return new AuthResponse(accessToken, "Bearer", expiresAt, user);
    }
}
