package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A payment against an invoice. Creating one also updates the invoice's paid
 * amount and status, and produces a receipt.
 */
@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payments_invoice", columnList = "invoice_id, status"),
        @Index(name = "idx_payments_received", columnList = "received_at DESC")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Payment extends BaseEntity {

    public enum Method {
        CASH,
        CARD,
        MOBILE,
        INSURANCE,
        BANK_TRANSFER
    }

    public enum Status {
        COMPLETED,
        FAILED,
        REVERSED
    }

    @Column(name = "payment_ref", nullable = false, unique = true, length = 40)
    private String paymentRef;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Builder.Default
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "method", nullable = false, length = 20)
    private Method method = Method.CASH;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.COMPLETED;

    @Column(name = "received_by_id", length = 36)
    private String receivedById;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name = "notes", length = 500)
    private String notes;

    public void reverse() {
        this.status = Status.REVERSED;
    }
}