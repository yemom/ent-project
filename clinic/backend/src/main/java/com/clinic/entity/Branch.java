package com.clinic.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Branch entity representing a hospital branch location.
 *
 * Fields: name, code, address, phone, email, type, active, notes
 */
@Entity
@Table(name = "branches", indexes = {
        @Index(name = "idx_branches_active", columnList = "active"),
        @Index(name = "idx_branches_code", columnList = "code")
})
@SQLDelete(sql = "UPDATE branches SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Builder
public class Branch extends BaseEntity {

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "code", nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "address", length = 300)
    private String address;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "email", length = 120)
    private String email;

    @Column(name = "type", length = 100)
    private String type;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;
}
