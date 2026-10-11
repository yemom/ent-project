package com.clinic.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Patient entity representing a patient in the clinic.
 * Extends User with patient-specific fields.
 *
 * Relationships:
 * - OneToMany with Appointment (patient can have multiple appointments)
 * - OneToMany with MedicalRecord (patient can have multiple medical records)
 * - OneToMany with PatientAssignment (assignment history to doctors)
 *
 * Fields: dateOfBirth, gender, medicalHistory, appointments, medicalRecords,
 * branchId, registrationNumber, checkedInAt
 */
@Entity
@DiscriminatorValue("PATIENT")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, exclude = {"appointments", "medicalRecords", "assignments"})
@SuperBuilder
public class Patient extends User {

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", length = 10)
    private Gender gender;

    @Column(name = "medical_history", columnDefinition = "text")
    private String medicalHistory;

    @Column(name = "blood_type", length = 5)
    private String bloodType;

    @Column(name = "allergies", columnDefinition = "text")
    private String allergies;

    @Column(name = "emergency_contact_name", length = 100)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    // ========== Front desk / scoping ==========

    /**
     * Owning branch is inherited from {@link User#branchId}, so staff and patient
     * rows share one column and one filter. Every scoped query filters on it so a
     * branch never sees another branch's records.
     */

    /** Human-readable registration number issued at the front desk. */
    @Column(name = "registration_number", length = 30)
    private String registrationNumber;

    /** Postal address. Nullable: patients registered at the front desk often lack one. */
    @Column(name = "address", length = 300)
    private String address;

    /** Set when the patient is checked in at the front desk; null once they leave. */
    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;

    // ========== Relationships ==========

    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Appointment> appointments = new ArrayList<>();

    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<MedicalRecord> medicalRecords = new ArrayList<>();

    /** Full assignment history; the active assignment is the one with releasedAt == null. */
    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PatientAssignment> assignments = new ArrayList<>();

    /** The doctor currently responsible for this patient, or null if unassigned. */
    @Transient
    public String getAssignedDoctorId() {
        if (assignments == null) {
            return null;
        }
        return assignments.stream()
                .filter(assignment -> assignment.getReleasedAt() == null)
                .filter(assignment -> assignment.getDoctor() != null)
                .map(assignment -> assignment.getDoctor().getId())
                .findFirst()
                .orElse(null);
    }

    public boolean isCheckedIn() {
        return checkedInAt != null;
    }
}