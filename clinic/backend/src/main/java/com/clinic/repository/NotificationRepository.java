package com.clinic.repository;

import com.clinic.entity.Notification;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    /**
     * Notifications visible to a principal: everything addressed to their user id
     * plus everything addressed to their role.
     */
    @Query("""
            select n from Notification n
            where n.recipientUserId = :userId or n.recipientRole = :role
            order by n.createdAt desc
            """)
    Page<Notification> findVisibleTo(@Param("userId") String userId,
                                     @Param("role") UserRole role,
                                     Pageable pageable);

    @Query("""
            select count(n) from Notification n
            where (n.recipientUserId = :userId or n.recipientRole = :role)
              and n.readAt is null
            """)
    long countUnreadFor(@Param("userId") String userId, @Param("role") UserRole role);

    @Query("""
            select n from Notification n
            where (n.recipientUserId = :userId or n.recipientRole = :role)
              and n.readAt is null
            order by n.createdAt desc
            """)
    List<Notification> findUnreadFor(@Param("userId") String userId, @Param("role") UserRole role);

    @Query("""
            select n from Notification n
            where (n.recipientUserId = :userId or n.recipientRole = :role)
              and n.id = :id
            """)
    Optional<Notification> findVisibleById(@Param("userId") String userId,
                                           @Param("role") UserRole role,
                                           @Param("id") String id);

    @Modifying
    @Query("""
            update Notification n set n.readAt = :readAt
            where (n.recipientUserId = :userId or n.recipientRole = :role) and n.readAt is null
            """)
    int markAllReadFor(@Param("userId") String userId,
                       @Param("role") UserRole role,
                       @Param("readAt") Instant readAt);
}