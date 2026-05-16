package com.clinic.entity;

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
        @Index(name = "idx_status", columnList = "status")
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

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;
}
