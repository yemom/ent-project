package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A single-use password-reset token.
 *
 * <p>Only the SHA-256 hash of the token is stored, exactly as with
 * {@link RefreshToken}. A database leak therefore yields no usable reset link: an
 * attacker with the table contents still needs the pre-image, which is 32 bytes of
 * {@link java.security.SecureRandom} output.
 *
 * <p>Three properties are enforced here rather than trusted to the caller:
 * expiry, single use, and per-user issuance limits.
 *
 * <p>No {@code @SQLDelete}/{@code @SQLRestriction} soft-delete behaviour is
 * applied. This table is deliberately not modelled as an {@code BaseEntity}
 * because audit queries need the consumed rows: "when was this token used, and for
 * which account" is a question a security review will ask, and a soft delete would
 * answer it with a blank.
 */
@Entity
@Table(name = "password_reset_tokens", indexes = {
        @Index(name = "idx_password_reset_user", columnList = "user_id"),
        @Index(name = "idx_password_reset_expiry", columnList = "expires_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    /**
     * SHA-256 of the emailed token, hex-encoded. Unique: the pre-image has 256
     * bits of entropy, so a collision here means a bug rather than a birthday.
     */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Set when the token is spent. A non-null value makes it permanently invalid. */
    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /**
     * Whether this token may still be redeemed.
     *
     * <p>Expiry is inclusive of "now must be strictly before the deadline", so a
     * token presented exactly at its expiry instant is already dead.
     */
    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }
}