package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

@Entity
@Table(name = "invoice_lines", indexes = {
        @Index(name = "idx_invoice_lines_invoice", columnList = "invoice_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class InvoiceLine extends BaseEntity {

    @NotBlank(message = "Description is required")
    @Column(name = "description", nullable = false, length = 200)
    private String description;

    @Builder.Default
    @Column(name = "category", nullable = false, length = 40)
    private String category = "CONSULTATION";

    @Positive(message = "Quantity must be positive")
    @Builder.Default
    @Column(name = "quantity", nullable = false)
    private Integer quantity = 1;

    @DecimalMin(value = "0.0", message = "Unit price must not be negative")
    @Builder.Default
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    /** amount is always quantity × unit price; called whenever either changes. */
    public void recalculateAmount() {
        BigDecimal qty = BigDecimal.valueOf(quantity == null ? 1 : quantity);
        BigDecimal price = unitPrice == null ? BigDecimal.ZERO : unitPrice;
        this.amount = qty.multiply(price);
    }
}