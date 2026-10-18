package com.clinic.repository;

import com.clinic.entity.AiPendingAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiPendingActionRepository extends JpaRepository<AiPendingAction, String> {

    /** Ownership-scoped: a confirmation id alone is never sufficient. */
    @Query("SELECT a FROM AiPendingAction a "
            + "WHERE a.id = :id AND a.ownerUserId = :ownerUserId")
    Optional<AiPendingAction> findOwnedById(@Param("id") String id,
                                            @Param("ownerUserId") String ownerUserId);

    List<AiPendingAction> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(String ownerUserId, String status);

    List<AiPendingAction> findByStatusAndExpiresAtBefore(String status, LocalDateTime cutoff);

    long countByOwnerUserIdAndCreatedAtAfter(String ownerUserId, LocalDateTime after);
}