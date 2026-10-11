package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * Append-only audit trail.
 *
 * <p>The table is created by a migration that installs a rule blocking UPDATE and
 * DELETE, so the application cannot rewrite history even with a bug or a
 * compromised account. Entries are written for logins, role changes, record
 * access/edits, refunds and break-glass access.
 */
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_logs_actor", columnList = "actor_id"),
        @Index(name = "idx_audit_logs_action_created", columnList = "action, created_at DESC"),
        @Index(name = "idx_audit_logs_target", columnList = "target_type, target_id"),
        @Index(name = "idx_audit_logs_branch", columnList = "branch_id, created_at DESC")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class AuditLog extends BaseEntity {

    /** Null for unauthenticated attempts (e.g. failed login on an unknown email). */
    @Column(name = "actor_id", length = 36)
    private String actorId;

    @Column(name = "actor_email", length = 100)
    private String actorEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_role", length = 20)
    private UserRole actorRole;

    @NotNull(message = "Action is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40)
    private AuditAction action;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id", length = 36)
    private String targetId;

    @Column(name = "branch_id", length = 36)
    private String branchId;

    /** Mandatory for break-glass access; free-form context elsewhere. */
    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;
}