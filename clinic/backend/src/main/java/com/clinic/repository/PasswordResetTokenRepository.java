package com.clinic.repository;

import com.clinic.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, String> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    List<PasswordResetToken> findByUserIdAndUsedAtIsNull(String userId);

    /**
     * Tokens issued for a user within a window, spent or not.
     *
     * <p>Used to cap issuance per account. The global
     * {@link com.clinic.config.RateLimitingFilter} buckets by client IP, which an
     * attacker with many addresses walks around; this count is keyed on the account
     * itself and is persisted, so it survives a restart.
     */
    @Query("SELECT COUNT(t) FROM PasswordResetToken t "
            + "WHERE t.userId = :userId AND t.createdAt >= :since")
    long countIssuedSince(@Param("userId") String userId, @Param("since") Instant since);

    /** Housekeeping: drop rows that can no longer be redeemed. */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}