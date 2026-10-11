package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * A ward inside a department. Owns rooms.
 */
@Entity
@Table(name = "wards", indexes = {
        @Index(name = "idx_wards_department", columnList = "department_id"),
        @Index(name = "idx_wards_active", columnList = "active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Ward extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @NotBlank(message = "Ward name is required")
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @NotBlank(message = "Ward code is required")
    @Column(name = "code", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "floor", length = 20)
    private String floor;

    @Positive(message = "Capacity must be positive")
    @Builder.Default
    @Column(name = "capacity", nullable = false)
    private Integer capacity = 1;

    @Builder.Default
    @Column(name = "active", nullable = false)
    private Boolean active = true;
}