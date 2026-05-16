package com.clinic.repository;

import com.clinic.entity.TokenBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface TokenBlacklistRepository extends JpaRepository<TokenBlacklist, String> {

    boolean existsByToken(String token);

    Optional<TokenBlacklist> findByToken(String token);

    long deleteByExpiresAtBefore(Instant cutoff);
}
