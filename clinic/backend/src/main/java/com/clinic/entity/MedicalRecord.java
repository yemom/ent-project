package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDate;

/**
 * MedicalRecord entity representing a patient's medical record.
 *
 * Relationships:
 * - ManyToOne with Patient (a record belongs to one patient)
 * - ManyToOne with Doctor (a record is created/updated by one doctor)
 * - ManyToOne with Appointment (a record can be associated with an appointment) - optional
 *
 * Fields: patient, doctor, appointment, diagnosis, treatment, prescription, notes, recordDate
 */
@Entity
@Table(name = "medical_records", indexes = {
        @Index(name = "idx_patient_id_mr", columnList = "patient_id"),
        @Index(name = "idx_doctor_id_mr", columnList = "doctor_id"),
        @Index(name = "idx_appointment_id_mr", columnList = "appointment_id"),
        @Index(name = "idx_record_date", columnList = "record_date")
})
@SQLDelete(sql = "UPDATE medical_records SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Builder
public class MedicalRecord extends BaseEntity {

    @NotNull(message = "Patient is required")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "patient_id", nullable = false, foreignKey = @ForeignKey(name = "fk_medical_record_patient"))
    private Patient patient;

    @NotNull(message = "Doctor is required")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_medical_record_doctor"))
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "appointment_id", nullable = true, foreignKey = @ForeignKey(name = "fk_medical_record_appointment"))
    private Appointment appointment;

    @Column(name = "diagnosis", columnDefinition = "text")
    private String diagnosis;

    @Column(name = "treatment", columnDefinition = "text")
    private String treatment;

    @Column(name = "prescription", columnDefinition = "text")
    private String prescription;

    @Column(name = "test_results", columnDefinition = "text")
    private String testResults;

    @Column(name = "vital_signs", columnDefinition = "text")
    private String vitalSigns; // e.g., "BP: 120/80, HR: 72, Temp: 98.6F"

    @Column(name = "follow_up_required", nullable = false)
    @Builder.Default
    private Boolean followUpRequired = false;

    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Column(name = "medical_record_type", length = 50)
    private String medicalRecordType; // e.g., "CONSULTATION", "SURGERY", "LAB_TEST", "VACCINATION"

    @Column(name = "is_confidential", nullable = false)
    @Builder.Default
    private Boolean isConfidential = false;

}
