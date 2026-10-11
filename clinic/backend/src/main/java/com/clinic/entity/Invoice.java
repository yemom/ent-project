package com.clinic.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A patient invoice.
 *
 * <p>Totals are stored rather than derived on read so a historical invoice cannot
 * silently change when a price list is updated. {@link #recalculate()} is the only
 * place subtotal/total are written, and it runs whenever lines change.
 */
@Entity
@Table(name = "invoices", indexes = {
        @Index(name = "idx_invoices_patient", columnList = "patient_id, status"),
        @Index(name = "idx_invoices_status", columnList = "status, issued_at DESC"),
        @Index(name = "idx_invoices_number", columnList = "invoice_number")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, exclude = "lines")
@SuperBuilder
public class Invoice extends BaseEntity {

    public enum Status {
        DRAFT,
        ISSUED,
        PARTIALLY_PAID,
        PAID,
        VOID
    }

    @Column(name = "invoice_number", nullable = false, unique = true, length = 40)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @Column(name = "appointment_id", length = 36)
    private String appointmentId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.ISSUED;

    @Builder.Default
    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "discount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "tax", nullable = false, precision = 12, scale = 2)
    private BigDecimal tax = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "notes", length = 500)
    private String notes;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<InvoiceLine> lines = new ArrayList<>();

    public BigDecimal getBalanceDue() {
        return total.subtract(amountPaid);
    }

    public boolean isSettled() {
        return status == Status.PAID || getBalanceDue().compareTo(BigDecimal.ZERO) <= 0;
    }

    public void addLine(InvoiceLine line) {
        line.setInvoice(this);
        lines.add(line);
    }

    /** Recomputes the persisted totals from the current lines. */
    public void recalculate() {
        this.subtotal = lines.stream()
                .map(InvoiceLine::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal afterDiscount = subtotal.subtract(discount);
        if (afterDiscount.compareTo(BigDecimal.ZERO) < 0) {
            afterDiscount = BigDecimal.ZERO;
        }
        this.total = afterDiscount.add(tax);
    }

    /** Moves the invoice to the state implied by its payment balance. */
    public void refreshPaymentStatus() {
        if (status == Status.VOID || status == Status.DRAFT) {
            return;
        }
        if (getBalanceDue().compareTo(BigDecimal.ZERO) <= 0) {
            this.status = Status.PAID;
        } else if (amountPaid.compareTo(BigDecimal.ZERO) > 0) {
            this.status = Status.PARTIALLY_PAID;
        } else {
            this.status = Status.ISSUED;
        }
    }
}