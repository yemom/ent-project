package com.clinic.repository;

import com.clinic.entity.AiConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AiConversationRepository extends JpaRepository<AiConversation, String> {

    /**
     * Scoped by owner in the query itself.
     *
     * <p>Returning {@link Optional} rather than a bare entity is the safety
     * property: a caller that forgets the ownership check gets {@code null} and a
     * 404, not another user's conversation. There is no unfiltered
     * {@code findById} on this interface for the same reason.
     */
    @Query("SELECT c FROM AiConversation c "
            + "WHERE c.id = :id AND c.ownerUserId = :ownerUserId AND c.deleted = false")
    Optional<AiConversation> findOwnedById(@Param("id") String id,
                                          @Param("ownerUserId") String ownerUserId);

    @Query("SELECT c FROM AiConversation c "
            + "WHERE c.ownerUserId = :ownerUserId AND c.deleted = false")
    Page<AiConversation> findOwnedByUser(@Param("ownerUserId") String ownerUserId, Pageable pageable);

    @Query("SELECT COUNT(c) FROM AiConversation c "
            + "WHERE c.ownerUserId = :ownerUserId AND c.deleted = false")
    long countOwnedBy(@Param("ownerUserId") String ownerUserId);
}