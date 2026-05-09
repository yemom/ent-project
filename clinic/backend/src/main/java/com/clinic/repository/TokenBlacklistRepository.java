package com.clinic.repository;

import com.clinic.entity.TokenBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TokenBlacklistRepository extends JpaRepository<TokenBlacklist, UUID> {

    boolean existsByToken(String token);

    Optional<TokenBlacklist> findByToken(String token);

    long deleteByExpiresAtBefore(Instant cutoff);
}
