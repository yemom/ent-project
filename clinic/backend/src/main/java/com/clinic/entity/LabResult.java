package com.clinic.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDateTime;

/**
 * Lab Result entity representing the results of a lab order.
 * 
 * Fields: id, labOrderId, labTechnicianId, findings, fileUrl, status,
 * submittedAt, createdAt, updatedAt
 */
@Entity
@Table(name = "lab_results", indexes = {
        @Index(name = "idx_lab_order_id", columnList = "lab_order_id"),
        @Index(name = "idx_lab_technician_id", columnList = "lab_technician_id"),
        @Index(name = "idx_lab_results_status", columnList = "status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class LabResult extends BaseEntity {

    @NotNull(message = "Lab Order ID is required")
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lab_order_id", nullable = false)
    @JsonIgnore
    private LabOrder labOrder;

    @NotNull(message = "Lab Technician ID is required")
    @Column(name = "lab_technician_id", nullable = false)
    private String labTechnicianId;

    @NotBlank(message = "Findings are required")
    @Column(name = "findings", columnDefinition = "TEXT", nullable = false)
    private String findings;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private LabResultStatus status = LabResultStatus.DRAFT;

    /**
     * Whether this result is clinically critical and needs urgent attention.
     *
     * <p>Set prospectively by the technician recording the result; existing rows
     * default to {@code false} rather than being backfilled, because guessing
     * whether a historical result was critical would raise alerts nobody reviewed.
     *
     * <p>Independent of {@link #status}: a critical result needs attention whether
     * or not it has been submitted yet.
     */
    @Builder.Default
    @Column(name = "is_critical", nullable = false)
    private Boolean critical = false;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;
}
