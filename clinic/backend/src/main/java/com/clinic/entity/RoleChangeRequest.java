package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Pending role change awaiting approval by a second privileged user.
 *
 * <p>Stops privilege escalation: an admin cannot change anyone's role — least
 * not their own — without a different privileged approver signing off.
 */
@Entity
@Table(name = "role_change_requests", indexes = {
        @Index(name = "idx_role_change_requests_status", columnList = "status, requested_at DESC"),
        @Index(name = "idx_role_change_requests_target", columnList = "target_user_id, status"),
        @Index(name = "idx_role_change_requests_approver", columnList = "approved_by_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleChangeRequest {

    public enum Status {
        PENDING,
        APPROVED,
        REJECTED
    }

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "target_user_id", nullable = false, length = 36)
    private String targetUserId;

    @Column(name = "target_user_email", length = 100)
    private String targetUserEmail;

    /**
     * Role held before the change. Named `previous_role` rather than
     * `current_role` because the latter is a reserved word in both H2 and
     * PostgreSQL.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "previous_role", nullable = false, length = 20)
    private UserRole currentRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_role", nullable = false, length = 20)
    private UserRole requestedRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "requested_by_id", nullable = false, length = 36)
    private String requestedById;

    @Column(name = "requested_by_email", length = 100)
    private String requestedByEmail;

    @Column(name = "approved_by_id", length = 36)
    private String approvedById;

    @Column(name = "approved_by_email", length = 100)
    private String approvedByEmail;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}