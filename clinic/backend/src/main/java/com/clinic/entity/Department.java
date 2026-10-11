package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * A clinical department (Cardiology, Radiology, …).
 *
 * <p>Replaces the earlier practice of inferring departments from doctor
 * specialisation, which meant the Hospital Admin dashboard had nothing real to
 * show. `headDoctorId` is a plain id rather than a JPA relation so the column can
 * point at a user row without constraining the single-table hierarchy.
 */
@Entity
@Table(name = "departments", indexes = {
        @Index(name = "idx_departments_active", columnList = "active"),
        @Index(name = "idx_departments_name", columnList = "name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Department extends BaseEntity {

    @NotBlank(message = "Department name is required")
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @NotBlank(message = "Department code is required")
    @Column(name = "code", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "head_doctor_id", length = 36)
    private String headDoctorId;

    @Builder.Default
    @Column(name = "active", nullable = false)
    private Boolean active = true;
}