package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal; // ✅ ADD THIS IMPORT
import java.util.ArrayList;
import java.util.List;

@Entity
@DiscriminatorValue("DOCTOR")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, exclude = { "appointments", "medicalRecords" })
@SuperBuilder
public class Doctor extends User {

    @NotBlank(message = "Specialization is required")
    @Column(name = "specialization", length = 100)
    private String specialization;

    @NotBlank(message = "License number is required")
    @Column(name = "license_number", unique = true, length = 50)
    private String licenseNumber;

    @Positive(message = "Years of experience must be positive")
    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "qualifications", columnDefinition = "text")
    private String qualifications;

    // ✅ FIXED: BigDecimal instead of Double
    @Column(name = "consultation_fee", precision = 10, scale = 2)
    private BigDecimal consultationFee;

    @Column(name = "bio", columnDefinition = "text")
    private String bio;

    @Column(name = "available")
    @Builder.Default
    private Boolean available = true;

    @OneToMany(mappedBy = "doctor", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Appointment> appointments = new ArrayList<>();

    @OneToMany(mappedBy = "doctor", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    @Builder.Default
    private List<MedicalRecord> medicalRecords = new ArrayList<>();
}