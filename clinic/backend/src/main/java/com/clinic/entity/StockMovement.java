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
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One immutable entry in the stock ledger.
 *
 * <p>Append-only: a Postgres trigger rejects UPDATE and DELETE. A mistake is
 * corrected by recording another movement, which is what a real stock audit trail
 * requires — silently editing history would make the ledger worthless.
 *
 * <p>{@code quantity} is always positive and {@code kind} decides the direction, so
 * the sign is never ambiguous and the database cannot be asked to record a
 * meaningless "-5 returned".
 */
@Entity
@Table(name = "stock_movements", indexes = {
        @Index(name = "idx_stock_movements_medicine", columnList = "medicine_id, performed_at DESC"),
        @Index(name = "idx_stock_movements_batch", columnList = "batch_id"),
        @Index(name = "idx_stock_movements_kind", columnList = "kind, performed_at DESC"),
        @Index(name = "idx_stock_movements_performed_by", columnList = "performed_by_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, exclude = "medicine")
@SuperBuilder
public class StockMovement extends BaseEntity {

    public enum Kind {
        /** Supplier delivery: increases stock. */
        RECEIVED,
        /** Dispensed against a prescription: decreases stock. */
        DISPENSED,
        /** Patient returned unused stock: increases stock. */
        RETURNED,
        /** Broken or unusable: decreases stock. */
        DAMAGED,
        /** Reached expiry and was written off: decreases stock. */
        EXPIRED,
        /** Stock count correction: increases or decreases, set by the caller. */
        ADJUSTED
    }

    @NotNull(message = "Medicine is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "medicine_id", nullable = false)
    private Medicine medicine;

    /**
     * The batch affected. Nullable because an ADJUSTMENT may target a medicine
     * with no live batch (for example the first receipt corrects a mis-entry).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private StockBatch batch;

    @NotNull(message = "Movement type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    private Kind kind;

    /** Always positive; the direction is implied by {@link #kind}. */
    @Builder.Default
    @NotNull(message = "Quantity is required")
    @Column(name = "quantity", nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity = BigDecimal.ZERO;

    /** Batch balance immediately after this movement — the reconciliation anchor. */
    @Builder.Default
    @NotNull(message = "Balance is required")
    @Column(name = "balance_after", nullable = false, precision = 12, scale = 2)
    private BigDecimal balanceAfter = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost = BigDecimal.ZERO;

    /** External reference: delivery note, prescription number, invoice. */
    @Column(name = "reference", length = 120)
    private String reference;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "performed_by_id", length = 36)
    private String performedById;

    @Column(name = "performed_by_name", length = 100)
    private String performedByName;

    @Column(name = "prescription_order_id", length = 36)
    private String prescriptionOrderId;

    @NotNull(message = "Movement date is required")
    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt;

    /**
     * Signed effect on a batch balance.
     *
     * <p>{@link Kind#ADJUSTED} takes its direction from the sign of
     * {@code quantity}, which the service encodes as a negative {@code quantity}
     * meaning "reduce". Every other kind has a fixed direction.
     */
    public BigDecimal signedQuantity() {
        BigDecimal absolute = quantity == null ? BigDecimal.ZERO : quantity.abs();
        return switch (kind) {
            case RECEIVED, RETURNED -> absolute;
            case DISPENSED, DAMAGED, EXPIRED -> absolute.negate();
            case ADJUSTED -> quantity == null || quantity.signum() >= 0
                    ? absolute
                    : absolute.negate();
        };
    }
}