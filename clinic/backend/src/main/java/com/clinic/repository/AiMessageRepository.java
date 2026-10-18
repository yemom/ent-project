package com.clinic.repository;

import com.clinic.entity.AiMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AiMessageRepository extends JpaRepository<AiMessage, String> {

    List<AiMessage> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    /**
     * The newest turns first, for replaying history into a model.
     *
     * <p>{@code Pageable} carries the cap; an unbounded history would grow the
     * prompt until it exceeded the provider's context window, or cost more than the
     * answer is worth.
     */
    @Query("SELECT m FROM AiMessage m WHERE m.conversationId = :conversationId ORDER BY m.createdAt DESC")
    Page<AiMessage> findRecent(@Param("conversationId") String conversationId, Pageable pageable);

    Page<AiMessage> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    long countByConversationIdAndCreatedAtAfter(String conversationId, LocalDateTime after);

    void deleteByConversationId(String conversationId);
}