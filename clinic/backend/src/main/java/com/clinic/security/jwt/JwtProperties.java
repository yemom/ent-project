package com.clinic.security.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param expirationMillis       access-token lifetime (kept short; refreshed via rotation)
 * @param refreshExpirationMillis refresh-token lifetime
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        String secret,
        long expirationMillis,
        String issuer,
        long refreshExpirationMillis
) {
    /**
     * HS512 requires a key of at least 512 bits. Without this check the failure
     * surfaces as a {@code SignatureException} on the first login — a 500 that
     * looks like an auth bug rather than a configuration one. Validating here
     * turns a silent misconfiguration into an actionable startup error.
     */
    private static final int MIN_SECRET_BYTES = 64;

    public JwtProperties {
        if (refreshExpirationMillis <= 0L) {
            // Default to 7 days when the property is not supplied.
            refreshExpirationMillis = 7L * 24 * 60 * 60 * 1000;
        }

        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "app.jwt.secret is not set. Sign in is impossible without it.");
        }

        int secretBytes = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if (secretBytes < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "app.jwt.secret must be at least " + MIN_SECRET_BYTES + " bytes for HS512 "
                            + "(got " + secretBytes + "). Generate one with: openssl rand -base64 64");
        }
    }
}