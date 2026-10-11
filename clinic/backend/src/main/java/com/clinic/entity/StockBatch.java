package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A physical lot of a medicine with its own expiry date and purchase cost.
 *
 * <p>{@code quantity} is the current balance and is only ever changed by recording a
 * {@link StockMovement}; {@code balanceAfter} on that movement records the result so
 * the ledger can be reconciled against the batch at any time.
 */
@Entity
@Table(name = "stock_batches", indexes = {
        @Index(name = "idx_stock_batches_medicine", columnList = "medicine_id, expiry_date"),
        @Index(name = "idx_stock_batches_expiry", columnList = "expiry_date"),
        @Index(name = "idx_stock_batches_supplier", columnList = "supplier_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, exclude = "medicine")
@SuperBuilder
public class StockBatch extends BaseEntity {

    @NotNull(message = "Medicine is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "medicine_id", nullable = false)
    private Medicine medicine;

    /** Null for a batch sourced without a recorded supplier. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @NotBlank(message = "Batch number is required")
    @Column(name = "batch_number", nullable = false, length = 60)
    private String batchNumber;

    @NotNull(message = "Expiry date is required")
    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Builder.Default
    @Column(name = "quantity", nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity = BigDecimal.ZERO;

    /** Cost captured at receipt; not overwritten when the catalogue price changes. */
    @Builder.Default
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost = BigDecimal.ZERO;

    @NotNull(message = "Received date is required")
    @Column(name = "received_at", nullable = false)
    private java.time.LocalDateTime receivedAt;

    @Column(name = "notes", length = 500)
    private String notes;

    public boolean isExpired(java.time.LocalDate asOf) {
        return expiryDate != null && expiryDate.isBefore(asOf);
    }

    /**
     * Within {@code days} of expiry. Used for the near-expiry alert; an already
     * expired batch counts as near-expiry too, because both need attention.
     */
    public boolean isExpiringWithin(java.time.LocalDate asOf, int days) {
        return expiryDate != null && !expiryDate.isAfter(asOf.plusDays(days));
    }
}