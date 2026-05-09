package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * PrescriptionOrder entity representing a drug order sent from doctor to pharmacy.
 *
 * Fields: doctorId, doctorName, patientName, drugName, dosage, instructions,
 * status, orderedAt, dispensedAt
 */
@Entity
@Table(name = "prescription_orders", indexes = {
        @Index(name = "idx_doctor_id_po", columnList = "doctor_id"),
        @Index(name = "idx_status_po", columnList = "status"),
        @Index(name = "idx_ordered_at", columnList = "ordered_at")
})
@SQLDelete(sql = "UPDATE prescription_orders SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Builder
public class PrescriptionOrder extends BaseEntity {

    @NotNull(message = "Doctor ID is required")
    @Column(name = "doctor_id", nullable = false)
    private UUID doctorId;

    @NotBlank(message = "Doctor name is required")
    @Column(name = "doctor_name", nullable = false, length = 100)
    private String doctorName;

    @NotBlank(message = "Patient name is required")
    @Column(name = "patient_name", nullable = false, length = 100)
    private String patientName;

    @NotBlank(message = "Drug name is required")
    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @NotBlank(message = "Dosage is required")
    @Column(name = "dosage", nullable = false, length = 100)
    private String dosage;

    @Column(name = "instructions", columnDefinition = "text")
    private String instructions;

    @NotNull(message = "Status is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private PrescriptionOrderStatus status = PrescriptionOrderStatus.PENDING;

    @NotNull(message = "Ordered at is required")
    @Column(name = "ordered_at", nullable = false)
    private LocalDateTime orderedAt;

    @Column(name = "dispensed_at")
    private LocalDateTime dispensedAt;
}
