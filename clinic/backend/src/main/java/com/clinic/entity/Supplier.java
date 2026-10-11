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

/** A supplier that delivers medicine batches. */
@Entity
@Table(name = "suppliers", indexes = {
        @Index(name = "idx_suppliers_name", columnList = "name"),
        @Index(name = "idx_suppliers_active", columnList = "active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Supplier extends BaseEntity {

    @NotBlank(message = "Supplier name is required")
    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "phone", length = 40)
    private String phone;

    @Column(name = "address", length = 300)
    private String address;

    @Builder.Default
    @Column(name = "active", nullable = false)
    private Boolean active = true;
}