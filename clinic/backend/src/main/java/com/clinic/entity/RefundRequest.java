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

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Refund request. Amounts above {@code APP_REFUND_APPROVAL_THRESHOLD} require
 * approval by a second privileged user before the money moves.
 */
@Entity
@Table(name = "refund_requests", indexes = {
        @Index(name = "idx_refund_requests_status", columnList = "status, requested_at DESC"),
        @Index(name = "idx_refund_requests_invoice", columnList = "invoice_id"),
        @Index(name = "idx_refund_requests_approver", columnList = "approved_by_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequest {

    public enum Status {
        PENDING_APPROVAL,
        APPROVED,
        REJECTED,
        COMPLETED
    }

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "invoice_id", nullable = false, length = 36)
    private String invoiceId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** True when the amount exceeded the cashier's self-approval limit. */
    @Column(name = "requires_approval", nullable = false)
    private Boolean requiresApproval;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING_APPROVAL;

    @Column(name = "requested_by_id", nullable = false, length = 36)
    private String requestedById;

    @Column(name = "requested_by_email", length = 100)
    private String requestedByEmail;

    @Column(name = "approved_by_id", length = 36)
    private String approvedById;

    @Column(name = "approved_by_email", length = 100)
    private String approvedByEmail;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}