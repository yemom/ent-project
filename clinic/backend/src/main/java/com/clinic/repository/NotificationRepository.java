package com.clinic.repository;

import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository
        extends JpaRepository<Notification, String>, JpaSpecificationExecutor<Notification> {

    /**
     * Whether this business event has already been announced.
     *
     * <p>Guards duplicate notifications before an insert. The authoritative check
     * is the unique index on {@code event_key}, added in V27; this exists so the
     * common case costs one indexed lookup rather than a caught constraint
     * violation.
     */
    boolean existsByEventKey(String eventKey);

    /**
     * Notifications visible to a principal: everything addressed to their user id
     * plus everything addressed to their role, narrowed by the optional filters.
     *
     * <p>Built as a {@link Specification} rather than a JPQL string with
     * {@code :param is null} guards, for two reasons:
     *
     * <ul>
     *   <li><b>It is the only correct way to express the read filter.</b> The
     *       obvious JPQL, {@code (n.readAt is not null) = :read}, is a comparison of
     *       one boolean predicate against a parameter and Hibernate rejects it at
     *       startup — it fails to parse, not to run, so the whole context dies with
     *       a {@code QueryCreationException} rather than a 500.</li>
     *   <li><b>The null checks disappear from the SQL.</b> An unset filter adds no
     *       predicate at all, so the unfiltered query keeps using
     *       {@code idx_notifications_user_read} instead of degrading to a scan
     *       behind {@code (? is null or …)}.</li>
     * </ul>
     *
     * <p>The recipient scope is applied unconditionally and the filters are
     * intersected with it, never substituted for it: a caller cannot widen what
     * they see by supplying a filter.
     */
    default Page<Notification> findVisibleTo(String userId,
                                             UserRole role,
                                             NotificationType type,
                                             Boolean read,
                                             Pageable pageable) {
        Specification<Notification> visible =
                (root, query, cb) -> cb.or(
                        cb.equal(root.get("recipientUserId"), userId),
                        cb.equal(root.get("recipientRole"), role));

        if (type != null) {
            Specification<Notification> byType =
                    (root, query, cb) -> cb.equal(root.get("type"), type);
            visible = visible.and(byType);
        }

        if (read != null) {
            // Unread is the hot path — the badge counts it — so it is tested as an
            // indexed null check rather than as a derived boolean.
            Specification<Notification> byReadState = Boolean.TRUE.equals(read)
                    ? (root, query, cb) -> cb.isNotNull(root.get("readAt"))
                    : (root, query, cb) -> cb.isNull(root.get("readAt"));
            visible = visible.and(byReadState);
        }

        return findAll(visible, pageable);
    }

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