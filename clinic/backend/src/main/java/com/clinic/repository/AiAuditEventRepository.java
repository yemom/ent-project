package com.clinic.repository;

import com.clinic.entity.AiAuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface AiAuditEventRepository extends JpaRepository<AiAuditEvent, String> {

    Page<AiAuditEvent> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    Page<AiAuditEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByUserIdAndCreatedAtAfter(String userId, LocalDateTime after);

    /** Retention sweep: run on a schedule, or opportunistically. */
    @Modifying
    @Query("DELETE FROM AiAuditEvent e WHERE e.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}