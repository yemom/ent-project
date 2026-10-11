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
 * A nursing observation: vital signs, a nursing note, or a record that a
 * prescribed medication was administered.
 *
 * <p>This is what gives the NURSE role something real to write. The nurse holds
 * {@code vital:write} and {@code medication:administer} but never
 * {@code diagnosis:write}, so this table carries observations only — it cannot
 * express a diagnosis or a prescription.
 */
@Entity
@Table(name = "nurse_observations", indexes = {
        @Index(name = "idx_nurse_obs_patient", columnList = "patient_id, observed_at DESC"),
        @Index(name = "idx_nurse_obs_kind", columnList = "kind, observed_at DESC"),
        @Index(name = "idx_nurse_obs_recorder", columnList = "recorded_by_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class NurseObservation extends BaseEntity {

    public enum Kind {
        VITALS,
        NURSING_NOTE,
        MEDICATION_ADMINISTRATION
    }

    @NotNull(message = "Patient is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @Column(name = "recorded_by_id", nullable = false, length = 36)
    private String recordedById;

    @Column(name = "recorded_by_name", length = 100)
    private String recordedByName;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "kind", nullable = false, length = 30)
    private Kind kind = Kind.VITALS;

    @Column(name = "blood_pressure", length = 20)
    private String bloodPressure;

    @Column(name = "heart_rate")
    private Integer heartRate;

    @Column(name = "temperature_c", precision = 4, scale = 1)
    private BigDecimal temperatureC;

    @Column(name = "respiratory_rate")
    private Integer respiratoryRate;

    @Column(name = "oxygen_saturation", precision = 5, scale = 2)
    private BigDecimal oxygenSaturation;

    @Column(name = "weight_kg", precision = 6, scale = 2)
    private BigDecimal weightKg;

    /** Populated only for MEDICATION_ADMINISTRATION. */
    @Column(name = "medication", length = 200)
    private String medication;

    @Column(name = "dose", length = 100)
    private String dose;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "observed_at", nullable = false)
    private LocalDateTime observedAt;
}