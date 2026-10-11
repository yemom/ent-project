package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/**
 * A medicine in the pharmacy catalogue.
 *
 * <p>The catalogue row holds the reorder threshold, not a stock level. Stock lives
 * on {@link StockBatch} because a medicine can be held in several lots with
 * different expiry dates and purchase prices, and a single "quantity" column here
 * could not say which lot is about to expire.
 */
@Entity
@Table(name = "medicines", indexes = {
        @Index(name = "idx_medicines_name", columnList = "name"),
        @Index(name = "idx_medicines_category", columnList = "category"),
        @Index(name = "idx_medicines_active", columnList = "active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Medicine extends BaseEntity {

    @NotBlank(message = "Medicine name is required")
    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @NotBlank(message = "Medicine code is required")
    @Column(name = "code", nullable = false, unique = true, length = 40)
    private String code;

    @Builder.Default
    @Column(name = "category", nullable = false, length = 60)
    private String category = "GENERAL";

    @Column(name = "form", length = 60)
    private String form;

    @Column(name = "strength", length = 60)
    private String strength;

    @Builder.Default
    @Column(name = "unit", nullable = false, length = 30)
    private String unit = "unit";

    /** Stock at or below this total across live batches raises a low-stock alert. */
    @Builder.Default
    @DecimalMin(value = "0.0", message = "Reorder level must not be negative")
    @Column(name = "reorder_level", nullable = false, precision = 12, scale = 2)
    private BigDecimal reorderLevel = BigDecimal.ZERO;

    @Builder.Default
    @DecimalMin(value = "0.0", message = "Unit cost must not be negative")
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost = BigDecimal.ZERO;

    /**
     * Whether dispensing requires a prescription order.
     *
     * <p>Recorded on the catalogue so the pharmacist's screen can refuse to dispense
     * a prescription-only medicine that was not prescribed, rather than relying on
     * the operator to notice.
     */
    @Builder.Default
    @Column(name = "requires_prescription", nullable = false)
    private Boolean requiresPrescription = true;

    @Builder.Default
    @Column(name = "active", nullable = false)
    private Boolean active = true;
}