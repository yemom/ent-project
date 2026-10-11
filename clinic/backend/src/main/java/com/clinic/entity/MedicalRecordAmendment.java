package com.clinic.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Immutable amendment of a signed medical record.
 *
 * <p>Signed records are never silently updated. An edit inserts an amendment row
 * holding the previous values plus who changed what and why, so the full history
 * of a record stays reconstructable.
 */
@Entity
@Table(name = "medical_record_amendments", indexes = {
        @Index(name = "idx_mr_amendments_record", columnList = "medical_record_id, created_at DESC"),
        @Index(name = "idx_mr_amendments_author", columnList = "amended_by_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class MedicalRecordAmendment extends BaseEntity {

    @NotNull(message = "Medical record is required")
    @Column(name = "medical_record_id", nullable = false, length = 36)
    private String medicalRecordId;

    @Column(name = "amended_by_id", length = 36)
    private String amendedById;

    @Column(name = "amended_by_name", length = 100)
    private String amendedByName;

    /** Mandatory: an amendment without a reason is rejected by validation. */
    @NotBlank(message = "An amendment reason is required")
    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    /** Field-level diff captured as "field:old->new" pairs. */
    @Column(name = "previous_values", columnDefinition = "TEXT")
    private String previousValues;

    @Column(name = "new_values", columnDefinition = "TEXT")
    private String newValues;

    @Column(name = "amended_at")
    private LocalDateTime amendedAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "medical_record_amendment_fields",
            joinColumns = @JoinColumn(name = "amendment_id"))
    @Column(name = "field_name", length = 60)
    @BatchSize(size = 50)
    @Builder.Default
    private List<String> fields = new ArrayList<>();
}