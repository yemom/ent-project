package com.clinic.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.List;

/**
 * Lab Order entity representing a request from a doctor for laboratory tests.
 *
 * Fields: id, patientId, doctorId, appointmentId, tests, urgency, clinicalNotes,
 * status, createdAt, updatedAt
 */
@Entity
@Table(name = "lab_orders", indexes = {
        @Index(name = "idx_patient_id", columnList = "patient_id"),
        @Index(name = "idx_doctor_id", columnList = "doctor_id"),
        @Index(name = "idx_status", columnList = "status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class LabOrder extends BaseEntity {

    @NotNull(message = "Patient ID is required")
    @Column(name = "patient_id", nullable = false)
    private String patientId;

    @NotNull(message = "Doctor ID is required")
    @Column(name = "doctor_id", nullable = false)
    private String doctorId;

    @Column(name = "appointment_id")
    private String appointmentId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "lab_order_tests", joinColumns = @JoinColumn(name = "lab_order_id"))
    @Column(name = "test_name")
    @BatchSize(size = 50)
    @NotEmpty(message = "At least one test must be selected")
    private List<String> tests = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "urgency", nullable = false, length = 20)
    @NotNull(message = "Urgency is required")
    @Builder.Default
    private LabUrgency urgency = LabUrgency.ROUTINE;

    @NotBlank(message = "Clinical notes are required")
    @Column(name = "clinical_notes", columnDefinition = "TEXT", nullable = false)
    private String clinicalNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private LabOrderStatus status = LabOrderStatus.PENDING;

    @OneToMany(mappedBy = "labOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonIgnore
    private List<LabResult> results = new ArrayList<>();
}
